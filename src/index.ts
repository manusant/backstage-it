import * as winston from "winston";
import {DatabaseManager} from "@backstage/backend-common";
import {Config, ConfigReader} from "@backstage/config";
import {Server} from "http";
import {TestServerConfig} from "./serverFactory";

/**
 * Class responsible for initializing the server and database for the application. It creates a logger,
 * sets up the database connection, starts the server, and provides utility methods for accessing the server address.
 *
 * Code Analysis:
 * * Main functionalities
 * * Creates a logger using the winston library.
 * * Sets up the database connection using the DatabaseManager class.
 * * Starts the server using the startServer function.
 * * Provides a utility method for accessing the server address.
 *
 * @example
 * // Initialize the server and database
 * await BackstageIt.setUp({
 *     appName: 'academy-server',
 *     platformName: 'backstage',
 *     logLevel: "debug",
 *     database: {
 *       databaseName: "academy",
 *       migrationsDir: resolvePackagePath(
 *         '@company/xyz-plugin',
 *         'migrations',
 *       )
 *     },
 *     server: async (options) => {
 *       return await startServer(options);
 *     }
 *   });
 *
 * // Access the server address
 * const serverAddress = BackstageIt.serverAddress();
 * */
export class BackstageIt {
    static server: Server;
    static database: any;

    /**
     * The initialize method is responsible for setting up the server and database for the application. It creates a logger,
     * sets up the database connection, starts the server, and provides a utility method for accessing the server address.
     *
     * */
    static async setUp(setUpConfig: TestServerConfig) {

        if (setUpConfig.database) {
            const {database} = await BackstageIt.createStore({
                ...setUpConfig.database,
                config: setUpConfig.config
            });
            BackstageIt.database = database;
        }

        if (setUpConfig.server) {
            /**
             * Logs must be in the JSON format, independently of the development language and framework of your application.
             * This helps Datadog to easily understand and extract information from your easily. Another big advantage of JSON logs
             * is that multi-line log messages (for example: stack traces) will appear in Datadog as a single line entry, making it easy
             * to read and search for the message.
             *
             * */
            const logger = BackstageIt.createLogger({
                service: setUpConfig.appName,
                platform: setUpConfig.platformName,
                logLevel: setUpConfig.logLevel
            });

            const port = process.env.BACKSTAGE_IT_PORT
                ? Number(process.env.BACKSTAGE_IT_PORT)
                : 0;

            BackstageIt.server = await setUpConfig.server({
                port,
                logger,
                enableCors: false,
                optionalConfig: setUpConfig.config,
                optionalDatabase: setUpConfig.database ? BackstageIt.database : undefined
            });

            if (setUpConfig.afterSetup) {
                await setUpConfig.afterSetup({
                    logger,
                    port: BackstageIt.serverPort(),
                    address: BackstageIt.serverAddress(),
                    server: BackstageIt.server,
                    database: BackstageIt.database
                });
            }
        }
    }

    /**
     * The destroy method is responsible for shutting down the server and destroying the database connection.
     * */
    static async destroy() {
        await (new Promise<void>((resolve) => {
            BackstageIt.server.close(() => {
                // Once the server is closed, resolve the Promise
                resolve();
            });
        }));

        // Check if the database exists before attempting to destroy it
        if (BackstageIt.database) {
            await BackstageIt.database.destroy();
        }
    }

    /**
     * The createLogger method is responsible for creating a logger object using the winston library. It configures the
     * logger to output logs to the console and sets the log format to include a timestamp. It also sets the default metadata for the logger,
     * including the service and platform names. The log level is set to "debug" and the created logger object is returned.
     * */
    static createLogger({service, platform, logLevel}: { service: string, platform: string, logLevel?: string }) {
        const logger = winston.createLogger({
            transports: [
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.splat()
                    )
                }),
            ],
        });

        logger.defaultMeta = {
            service,
            platform,
        };
        logger.level = logLevel ?? "debug";

        return logger;
    };

    /**
     * The createStore method is responsible for creating a database connection using the DatabaseManager class and running the latest database migrations.
     * */
    static async createStore({databaseName, migrationsDir, config}: {
        databaseName: string,
        migrationsDir: string,
        config?: Config
    }) {
        const databaseConfig = config ? config.get<{}>("backend.database") : {
            backend: {
                database: {
                    client: 'better-sqlite3',
                    connection: ':memory:',
                },
            },
        };

        const database = await DatabaseManager.fromConfig(new ConfigReader(databaseConfig))
            .forPlugin(databaseName)
            .getClient();

        await database.migrate.latest({
            directory: migrationsDir,
        });

        return {
            database
        };
    }

    /**
     * The serverAddress method  returns the address of the server that is running the application.
     * */
    static serverAddress() {
        const port = BackstageIt.serverPort();
        return 'http://127.0.0.1:' + port;
    }

    /**
     * The serverPort method is a static method of the BackstageIt class that returns the port number of the server running the application.
     * */
    static serverPort(): number {
        const address = BackstageIt.server.address();
        if (!address) {
            throw new Error("Test server not running");
        }
        return (address as any).port;
    }
}
