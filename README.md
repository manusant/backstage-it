# Backstage-IT

Backstage-IT is an utility library designed to simplify the setup and teardown process for testing backend applications 
in the Backstage ecosystem. It provides convenient methods for initializing the server and database, making it easier 
to write integration tests.

## Installation

To install Backstage-IT, you can use npm:

```bash
npm install backstage-it --save-dev
```

## Usage
To use BackstageIt with [Jest](https://jestjs.io/) for testing your backend application, follow these steps to configure Jest:

1. **Install Jest**: If you haven't already installed Jest, you can do so using npm:
```bash
npm install jest --save-dev
```
2. **Create Jest Configuration**: Create a Jest configuration file (e.g., `jest.config.js`) in the root of your project with the following content:
```javascript 
// jest.config.js
module.exports = {
  // Other Jest configuration options...
    rootDir: __dirname,
    testEnvironment: 'node',
    clearMocks: true,
    setupFilesAfterEnv: [
        '<rootDir>/tests/jest.setup.ts', 
        '<rootDir>/tests/jest.teardown.ts'
    ]
};
```
3. In your `/tests` folder, create the `jest.setup.ts` file for the test environment setup and  `jest.teardown.ts` for  teardown.
```typescript 
// jest.setup.ts
import {resolvePackagePath} from "@backstage/backend-common";
import {startServer} from "../src";
import {request} from "pactum";
import {BackstageIt} from "backstage-it";

beforeAll(async () => {
    await BackstageIt.setUp({
        appName: 'my-service',
        platformName: 'backstage',
        logLevel: "debug",
        database: {
            databaseName: "my-service-db",
            migrationsDir: resolvePackagePath(
                '@my-company/my-service-plugin',
                'migrations',
            )
        },
        server: async (options) => {
            // Do additional configuration or dependency resolution here as needed
            // For example: instantiate services that your server needs other than the defaults coming within options
            return await startServer(options);
        },
        afterSetup: async ({address, logger}) => {
            // Additional setup logic after the server is started
            logger.info(`Test Server running at ${address}`);
        }
    });
});
```
and the Teardown script:
```typescript 
// jest.teardown.ts
import {BackstageIt} from "backstage-it";

afterAll(async () => {
    await BackstageIt.destroy();
});
```
4. **Write Integration Tests**: Write integration tests using [Jest](https://jestjs.io/) to test your backend application. For example: 
```typescript

describe('Server Integration Tests', () => {

    it('should handle GET requests to /api/endpoint', async () => {

        // Create a repository that uses the databse through Knex
        const repository = new SampleRepository(BackstageIt.database);

        // Call the repository to create and persist a new entity
        const entity = await repository.create(CONTENT);

        // Call the REST API to retrieve the create entity by using the generated ID
        const response = await spec()
            .get(`/api/endpoint/${entity.id!}`)
            .expectStatus(200)
            .returns<Promise<SampleEntity>>("res.body");

        // Asset to make sure the API returned the same item that was created in the database
        expect(response).toBeDefined();
        expect(response.id).toBe(entity.id);
    })
});
```

### Usage with [PactumJs](https://pactumjs.github.io/)
You are free to use the library that best fits your needs. Just in case you want to use it with [PactumJs](https://pactumjs.github.io/), 
you just need to configure Pactum in the initialization callback:

```typescript 
// jest.setup.ts
import {resolvePackagePath} from "@backstage/backend-common";
import {startServer} from "../src";
import {request} from "pactum";
import {BackstageIt} from "backstage-it";

beforeAll(async () => {
    await BackstageIt.setUp({
        ...
        afterSetup: async ({address, logger}) => {
            // Additional setup logic after the server is started
            logger.info(`Test Server running at ${address}`);
            // Pre-configure PactumJs: Sets the server address for Pactum framework
            request.setBaseUrl(address);
        }
    });
});
```
Then you can do API Tests without specifying the server address:
```typescript
...
// Call the REST API to retrieve the create entity by using the generated ID
const response = await spec()
    .get(`/api/endpoint/${entity.id!}`)
    .expectStatus(200)
    .returns<Promise<SampleEntity>>("res.body");
...
```

## Database Only
If you want to test the persistence layer only, there is no need to start the serve, in such case, you can skip the start server configuration.

```typescript
await BackstageIt.setUp({
    appName: 'academy-server',
    platformName: 'backstage',
    logLevel: 'debug',
    database: {
      databaseName: 'academy',
      migrationsDir: resolvePackagePath(
        '@mercedes-benz/academy-server',
        'migrations',
      ),
    }
  });
```

## API
`BackstageIt.setUp(config: TestServerConfig)` Initializes the server and database for the application. Accepts a configuration 
object with the following properties:

* appName: Name of the application.
* platformName: Name of the platform.
* config: Optional Backstage config object. When not specified an in-memory sqlite database is used and the applications reads configuration from app-config files.
* logLevel: Log level for the logger.
* database: Configuration object for the database.
* server: Function that starts the server.
* afterSetup: Optional function called after the server is started.

`BackstageIt.destroy()` Shuts down the server and destroys the database connection.

`BackstageIt.serverAddress(): string` Returns the address of the server.

`BackstageIt.serverPort(): number` Returns the port number of the server.

## The Server
The integration tests should be able to run the same start server script that your application uses in order to keep things paired
and make sure tests are bootstrapping the real application.

Something similar to the following:
```typescript
export async function startServer(options: ServerOptions): Promise<Server> {
    const logger = options.logger.child({plugin: PLUGIN_ID});

    logger.info('Loading configurations ...');
    const config = options.optionalConfig ?? await loadBackendConfig({
        argv: process.argv,
        logger,
    });

    const environment = await createEnv(config, logger, options.optionalDatabase);

    logger.info('Registering API...');
    const router = await createRouter(environment);

    const service = createServiceBuilder(module)
        .enableCors({origin: '*'})
        .setRequestLoggingHandler(createRequestLogger)
        .addRouter('', await createHealthRouter())
        .addRouter('/my-api', router);

    logger.info('Starting Server...');
    return service
        .setPort(options.port)
        .start()
        .catch(err => {
            logger.error(err);
            process.exit(1);
        });
}
```
