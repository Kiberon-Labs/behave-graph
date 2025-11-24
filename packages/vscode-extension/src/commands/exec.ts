import {
  DefaultLogger,
  Engine,
  ILifecycleEventEmitter,
  Logger,
  LogLevel,
  ManualLifecycleEventEmitter,
  readGraphFromJSON,
  registerCoreProfile,
  validateGraph,
  validateRegistry
} from '@kiberon-labs/behave-graph';

type ProgramOptions = {
  logLevel?: LogLevel;
  dryRun?: boolean;
  limitIterations?: number;
  limitSeconds: number;
};

export type ExecGraphOpts = {
  /**
   * The raw json string
   */
  graphjson: string;
  programOptions: ProgramOptions;
};

export async function execGraph({ graphjson, programOptions }: ExecGraphOpts) {
  const registry = registerCoreProfile({
    values: {},
    nodes: {},
    dependencies: {
      ILogger: new DefaultLogger(),
      ILifecycleEventEmitter: new ManualLifecycleEventEmitter()
    }
  });

  if (programOptions.logLevel) {
    Logger.logLevel = programOptions.logLevel;
  }

  const graph = readGraphFromJSON({
    graphJson: JSON.parse(graphjson),
    registry
  });

  const errorList: string[] = [];
  errorList.push(...validateRegistry(registry), ...validateGraph(graph));

  if (errorList.length > 0) {
    Logger.error(`${errorList.length} errors found:`);
    errorList.forEach((errorText, errorIndex) => {
      Logger.error(`${errorIndex}: ${errorText}`);
    });
    return;
  }

  Logger.verbose('creating behavior graph');
  const engine = new Engine(graph.nodes);

  // do not log at all to the verbose if not verbose is not enabled, makes a big performance difference.
  if (programOptions.logLevel === LogLevel.Verbose) {
    engine.onNodeExecutionStart.addListener((node) =>
      Logger.verbose(`<< ${node.description.typeName} >> START`)
    );
    engine.onNodeExecutionEnd.addListener((node) =>
      Logger.verbose(`<< ${node.description.typeName} >> END`)
    );
  }

  if (programOptions.dryRun) {
    return;
  }

  const lifecycleEventEmitter = registry.dependencies
    .ILifecycleEventEmitter! as ILifecycleEventEmitter;
  const startTime = Date.now();
  if (lifecycleEventEmitter.startEvent.listenerCount > 0) {
    Logger.verbose('triggering start event');
    lifecycleEventEmitter.startEvent.emit();

    Logger.verbose('executing all (async)');
    await engine.executeAllAsync(5);
  }

  if (lifecycleEventEmitter.tickEvent.listenerCount > 0) {
    const iterations = programOptions.limitIterations ?? 5;
    for (let tick = 0; tick < iterations; tick++) {
      Logger.verbose(`triggering tick (${tick} of ${iterations})`);
      lifecycleEventEmitter.tickEvent.emit();

      Logger.verbose('executing all (async)');
      // eslint-disable-next-line no-await-in-loop
      await engine.executeAllAsync(programOptions.limitSeconds);
    }
  }

  if (lifecycleEventEmitter.endEvent.listenerCount > 0) {
    Logger.verbose('triggering end event');
    lifecycleEventEmitter.endEvent.emit();

    Logger.verbose('executing all (async)');
    await engine.executeAllAsync(5);
  }

  const deltaTime = Date.now() - startTime;
  Logger.verbose(
    `profile results: ${engine.executionSteps} nodes executed in ${
      deltaTime / 1000
    } seconds, at a rate of ${Math.round(
      (engine.executionSteps * 1000) / deltaTime
    )} steps/second`
  );

  engine.dispose();
}
