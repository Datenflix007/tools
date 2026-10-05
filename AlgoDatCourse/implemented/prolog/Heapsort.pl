/*
 * Heapsort mit Nutzung von MaxHeap.pl
 */

:- consult('MaxHeap.pl').

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% HEAPSORT
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

heapsort(A, Sorted) :-
    build_max_heap(A, Heap),
    length(Heap, HeapSize),
    heapsort_loop(Heap, HeapSize, Sorted).

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% SORTIERUNG
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

heapsort_loop(Heap, 1, Heap).

heapsort_loop(Heap, HeapSize, Sorted) :-
    LastIndex is HeapSize - 1,
    swap(Heap, 0, LastIndex, SwappedHeap),
    NewHeapSize is HeapSize - 1,
    prefix_length(ActiveHeap, SwappedHeap, NewHeapSize),
    nth0(LastIndex, SwappedHeap, SortedElement),
    max_heapify(ActiveHeap, NewHeapSize, 0, HeapifiedPart),
    append(HeapifiedPart, [SortedElement], TempHeap),
    heapsort_loop(TempHeap, NewHeapSize, Sorted).

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% MAIN
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

main :-
    A = [3,1,4,1,5,9,2,6,5,3,5],
    heapsort(A, Sorted),
    write('Sorted Array: '),
    writeln(Sorted).