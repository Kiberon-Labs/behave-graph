import { useMemo, useEffect, useState } from "react";
export type PreviewOpts = {
    node: string
}


export const Preview = ({ node }: PreviewOpts) => {
    const [FlowComponent, setFlowComponent] = useState<any>(null);

    const graph = useMemo(() => {
        return {
            "nodes": [
                {
                    "type": node,
                    "id": "0"
                }
            ]
        }
    }, [node])


    useEffect(() => {
        import("./component").then((module) => {
            setFlowComponent(() =>
                () => <module.Graph graph={graph} />
            );
        });
    }, []);

    if (!FlowComponent) {
        return <div className="h-lvh not-content">Loading...</div>;
    }

    return <div className="h-lvh not-content">
        <FlowComponent />
    </div >
}