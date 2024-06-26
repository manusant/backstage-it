import {Server} from "http";
import {Logger} from "winston";
import {Knex} from "knex";
import {Config} from "@backstage/config";

export type TestServerConfig = {
  appName: string;
  platformName: string;
  config?: Config;
  logLevel?: string;
  database?: { databaseName: string, migrationsDir: string, };
  server?: ServerFactory,
  afterSetup?: AfterSetupFactory
}

export type ServerOptions = {
  port: number;
  enableCors: boolean;
  logger: Logger;
  optionalDatabase?: Knex,
  optionalConfig?: Config,
}

export type ServerContext = {
  address: string;
  port: number;
  server: Server;
  logger: Logger;
  database?: Knex;
}

export type ServerFactory = (options: ServerOptions) => Promise<Server>;

export type AfterSetupFactory = (context: ServerContext) => Promise<void>;
