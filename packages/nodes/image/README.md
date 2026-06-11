# Behave-Graph Images

This is an extension module for the core behaviour graph to support image manipulation. It exports a simple register plugin for the core registry as well as another register plugin when you want to interact with the core flow UI


## Usage 

1. No UI

```ts
import {registerProfile} from '@kiberon-labs/behave-graph-nodes-image';


const newReg =await registerProfile(existingRegistry);

```