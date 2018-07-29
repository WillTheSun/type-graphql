import "reflect-metadata";
import { GraphQLServer, Options } from "graphql-yoga";
import Container, { ContainerInstance } from "typedi";
import { useContainer, buildSchema, ResolverData } from "../../src";

import { RecipeResolver } from "./recipe/recipe.resolver";
import { Context } from "./types";
import { setSamplesInContainer } from "./recipe/recipe.samples";

async function bootstrap() {
  setSamplesInContainer();

  // register our custom, scoped IOC container by passing a extracting from resolver data function
  useContainer<Context>(({ context }) => context.container);

  // build TypeGraphQL executable schema
  const schema = await buildSchema({
    resolvers: [RecipeResolver],
  });

  // Create GraphQL server
  const server = new GraphQLServer({
    schema,
    // we need to provide unique context with `requestId` for each request
    context: (): Context => {
      const requestId = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER); // uuid-like
      const container = Container.of(requestId); // get scoped container
      const context = { requestId, container }; // create our context
      container.set("context", context); // place context or other data in container
      return context;
    },
  });

  // Configure server options
  const serverOptions: Options = {
    port: 4000,
    endpoint: "/graphql",
    playground: "/playground",
    formatResponse: (response: any, { context }: ResolverData<Context>) => {
      // remember to dispose the scoped container to prevent memory leaks
      Container.reset(context.requestId);

      // for developers curiosity purpose, here is the logging of current scoped container instances
      // you can make multiple parallel requests to see in console how this works
      const instancesIds = ((Container as any).instances as ContainerInstance[]).map(
        instance => instance.id,
      );
      console.log("instances left in memory:", instancesIds);

      return response;
    },
  };

  // Start the server
  server.start(serverOptions, ({ port, playground }) => {
    console.log(
      `Server is running, GraphQL Playground available at http://localhost:${port}${playground}`,
    );
  });
}

bootstrap();
