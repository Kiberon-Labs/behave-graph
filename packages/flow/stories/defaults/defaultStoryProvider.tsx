import { SystemProvider } from "@/system/provider"
import { System } from "@/system/system"
import { registerCoreProfile } from "@kiberon-labs/behave-graph"

const testRegistry = registerCoreProfile({
    nodes: {},
    values: {},
    dependencies: {}
});



const defaultSys = new System(testRegistry)

defaultSys.logsStore.getState().append({
    data: 'Test 1',
    time: new Date(),
    type: 'info'
})
defaultSys.logsStore.getState().append({
    data: 'Test 2',
    time: new Date(),
    type: 'error'
})

defaultSys.flowStore.getState().setInitialGraph(
    {
        "nodes": [
            {
                "type": "lifecycle/onStart",
                "id": "0",
                "flows": {
                    "flow": {
                        "nodeId": "1",
                        "socket": "flow"
                    }
                }
            },
            {
                "type": "flow/branch",
                "id": "1",
                "parameters": {
                    "condition": {
                        "value": false
                    }
                },
                "flows": {
                    "true": {
                        "nodeId": "2",
                        "socket": "flow"
                    },
                    "false": {
                        "nodeId": "3",
                        "socket": "flow"
                    }
                }
            },
            {
                "type": "debug/log",
                "id": "2",
                "parameters": {
                    "text": {
                        "value": "Condition is true!"
                    }
                }
            },
            {
                "type": "debug/log",
                "id": "3",
                "parameters": {
                    "text": {
                        "value": "Condition is false!"
                    }
                }
            }
        ]
    }



)


export const DefaultSystemProvider = ({ children }: { children: React.ReactElement }) => {

    return <SystemProvider value={defaultSys}>
        {children}
    </SystemProvider>

}
