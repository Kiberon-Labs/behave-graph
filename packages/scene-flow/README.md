# Behave-Graph Suspendable

This is an extension to behaviour graphs to implement a suspendable engine. While behaviour graphs are great, they have issues with serializing them during an existing execution. This implements a suspendable engine, which relies on nodes implementing the suspendable interface. The engine can be suspended mid execution, serialized and then unsuspended.

This is a work in progress as there are a number of edge cases that need to be accounted for 
