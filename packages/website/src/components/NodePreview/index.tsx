import { Flow } from "@kiberon-labs/behave-graph-flow";
import { DefaultLogger, ManualLifecycleEventEmitter, registerCoreProfile, type IRegistry } from "@kiberon-labs/behave-graph";
import { useMemo } from "react";

export type PreviewOpts = {
    node: string
}

export const useRegistry = () => {
    return useMemo<IRegistry>(
        () =>
            registerCoreProfile({
                values: {},
                nodes: {},
                dependencies: {
                    ILogger: new DefaultLogger(),
                    ILifecycleEventEmitter: new ManualLifecycleEventEmitter(),
                }
            }),
        []
    );
};



export const Preview = ({ node }: PreviewOpts) => {


    const registry = useRegistry();

    const graph = useMemo(() => {
        return {
            "nodes": [
                {
                    "type": node,
                    "id": "0"
                }
            ]
        }
    }, [])


    return <div className="h-lvh not-content">
        < Flow registry={registry} initialGraph={graph} examples={{}
        } />
    </div >
}