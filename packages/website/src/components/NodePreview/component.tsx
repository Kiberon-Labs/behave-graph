import { DefaultLogger, registerCoreProfile, type GraphJSON } from "@kinforge/behave-graph";
import { LayoutController, System, SystemProvider } from "@kinforge/behave-graph-flow"
import { useMemo } from "react";

export const Graph = ({ graph }: { graph: GraphJSON }) => {
    const system = useMemo(() => {

        const registy = registerCoreProfile({
            nodes: {},
            values: {},
            dependencies: {
                ILogger: new DefaultLogger()
            }
        })
        const system = new System(registy);

        system.flowStore.getState().setInitialGraph(graph)

        return system;
    }, [graph]);

    return <SystemProvider value={system}>
        <LayoutController></LayoutController>
    </SystemProvider>
}