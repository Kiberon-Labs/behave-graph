import { System, SystemProvider } from '@kiberon-labs/behave-graph-flow';
import {
  registerCoreProfile,
  writeNodeSpecsToJSON,
  type Dependencies
} from '@kiberon-labs/behave-graph';
import { imagePlugin } from '@/ui';
const coreRegistry = registerCoreProfile({
  nodes: {},
  values: {},
  //Not important
  dependencies: {} as Dependencies
});

const nodeSpecs = writeNodeSpecsToJSON(coreRegistry);
const nodeRegistry = {
  values: coreRegistry.values,
  specs: nodeSpecs
};

const defaultSys = new System(nodeRegistry);

defaultSys.registerPlugin(imagePlugin).then(() => {
  defaultSys.tabStore.getState().setLayout({
    dockbox: {
      mode: 'vertical',
      children: [
        {
          mode: 'horizontal',
          children: [
            {
              size: 2,
              mode: 'vertical',
              children: [
                {
                  mode: 'horizontal',
                  children: [
                    {
                      size: 3,
                      mode: 'vertical',
                      children: [
                        {
                          tabs: [
                            {
                              id: 'events'
                            },
                            {
                              id: 'traces'
                            }
                          ]
                        }
                      ]
                    },
                    {
                      size: 17,
                      mode: 'vertical',
                      children: [
                        {
                          id: 'graphs',
                          size: 700,
                          group: 'graph',
                          tabs: [
                            {
                              id: 'graph'
                            }
                          ]
                        }
                      ]
                    },
                    {
                      size: 4,
                      mode: 'vertical',
                      children: [
                        {
                          size: 12,
                          tabs: [
                            {
                              id: 'imageOutput'
                            }
                          ]
                        },
                        {
                          size: 12,
                          tabs: [
                            {
                              id: 'nodeInputs'
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  });

  defaultSys.flowStore.getState().setGraph({
    nodes: [
      {
        id: '57dab1a3-1be8-46b0-bb26-30c0d85205a2',
        type: 'output/image',
        metadata: {
          positionX: '350.87706858372366',
          positionY: '120.31909782555303'
        },
        parameters: {
          image: {
            link: {
              nodeId: 'dd2b23a6-51c2-4c3a-86cc-3fd1bf969e74',
              socket: 'image'
            }
          }
        }
      },
      {
        id: 'e933e01c-37d5-4164-aa94-f71b122f48f9',
        type: 'image/fetch',
        metadata: {
          positionX: '-331.0386955489421',
          positionY: '110.11548148393638'
        },
        parameters: {
          url: {
            value:
              'https://imgs.search.brave.com/k4E2998A3YKELJpQWpw_L4cMhvNDhN-3Oz0PHzDGD50/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9pbWcu/ZnJlZXBpay5jb20v/cHJlbWl1bS1waG90/by9hYnN0cmFjdC13/aXRjaC1maWd1cmUt/Y29sb3JmdWwtd2hp/cmx3aW5kLW1hZ2lj/XzExNjYxMDktMTIw/MTkuanBnP3NlbXQ9/YWlzX2h5YnJpZCZ3/PTc0MCZxPTgw'
          }
        }
      },
      {
        id: '99dbf8e1-f905-49fb-a089-c4fe0db99870',
        type: 'image/compose',
        metadata: {
          positionX: '-87.02195645139113',
          positionY: '343.6641020128248'
        },
        parameters: {
          operator: {
            value: 'Negate'
          },
          a: {
            link: {
              nodeId: 'e933e01c-37d5-4164-aa94-f71b122f48f9',
              socket: 'image'
            }
          },
          b: {
            link: {
              nodeId: '80fe8b76-eb45-440b-9ff0-10f615a5b3fd',
              socket: 'image'
            }
          }
        }
      },
      {
        id: '80fe8b76-eb45-440b-9ff0-10f615a5b3fd',
        type: 'image/fetch',
        metadata: {
          positionX: '-323.90764964559764',
          positionY: '346.6586716434417'
        },
        parameters: {
          url: {
            value:
              'https://imgs.search.brave.com/FkZm-FNVegayeANp2Uap0X6aPGGfEQAxZ9lHdSIZc64/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9jZG4u/cGl4YWJheS5jb20v/cGhvdG8vMjAyNC8w/MS8xMS8xMy81Mi9h/aS1nZW5lcmF0ZWQt/ODUwMTcxMl82NDAu/cG5n'
          }
        }
      },
      {
        id: '2fd04e8e-6246-4e34-b169-8dddbd1d4c5e',
        type: 'image/solarize',
        metadata: {
          positionX: '292.5094996512323',
          positionY: '353.1855662052151'
        },
        parameters: {
          factor: {
            value: 100
          },
          image: {
            link: {
              nodeId: '99dbf8e1-f905-49fb-a089-c4fe0db99870',
              socket: 'image'
            }
          }
        }
      },
      {
        id: '2a7e76e4-7c0f-4493-a968-50dd05c01ff1',
        type: 'image/fetch',
        metadata: {
          positionX: '-118.12778697893941',
          positionY: '45.75426667161685'
        },
        parameters: {
          url: {
            value:
              'https://imgs.search.brave.com/mI_NsYVxXMJMCA1C0jPMzGZlVkHK5R7DYtv45OE83nM/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9zdGF0/aWMudmVjdGVlenku/Y29tL3N5c3RlbS9y/ZXNvdXJjZXMvdGh1/bWJuYWlscy8wNzAv/NDM3LzU1MC9zbWFs/bC92aWJyYW50LWNv/bG9yLXNwbGFzaC1h/YnN0cmFjdC1wYWlu/dC1leHBsb3Npb25n/cmFwaHktcGhvdG8u/anBn'
          }
        }
      },
      {
        id: 'dd2b23a6-51c2-4c3a-86cc-3fd1bf969e74',
        type: 'image/compose',
        metadata: {
          positionX: '109.59711989947613',
          positionY: '140.63964453762333'
        },
        parameters: {
          operator: {
            value: 'Multiply'
          },
          a: {
            link: {
              nodeId: '2a7e76e4-7c0f-4493-a968-50dd05c01ff1',
              socket: 'image'
            }
          },
          b: {
            link: {
              nodeId: '99dbf8e1-f905-49fb-a089-c4fe0db99870',
              socket: 'image'
            }
          }
        }
      }
    ],
    variables: [],
    customEvents: []
  });
});

export const DefaultSystemProvider = ({
  children
}: {
  children: React.ReactElement;
}) => {
  return <SystemProvider value={defaultSys}>{children}</SystemProvider>;
};
