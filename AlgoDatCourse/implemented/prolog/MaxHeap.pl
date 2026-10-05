/*
 * Eingabe:    Eine unsortierte Liste von Zahlen.
 * Ausgabe:    Eine Liste, die als Max-Heap organisiert ist.
 */

:- use_module(library(lists)).

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% HAUPTMETHODEN
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

build_max_heap(A, Heap) :-
    length(A, HeapSize),
    Start is HeapSize // 2 - 1,
    build_heap_down(Start, HeapSize, A, Heap).

build_heap_down(-1, _, Heap, Heap).

build_heap_down(I, HeapSize, A, Heap) :-
    max_heapify(A, HeapSize, I, TempHeap),
    NextI is I - 1,
    build_heap_down(NextI, HeapSize, TempHeap, Heap).

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% MAX HEAPIFY
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

max_heapify(A, HeapSize, I, Heap) :-

    left(I, L),
    right(I, R),

    nth0(I, A, AI),

    (
        L < HeapSize,
        nth0(L, A, AL),
        AL > AI
    ->
        Largest1 = L
    ;
        Largest1 = I
    ),

    nth0(Largest1, A, ALargest1),

    (
        R < HeapSize,
        nth0(R, A, AR),
        AR > ALargest1
    ->
        Largest = R
    ;
        Largest = Largest1
    ),

    (
        Largest =\= I
    ->
        swap(A, I, Largest, TempHeap),
        max_heapify(TempHeap, HeapSize, Largest, Heap)
    ;
        Heap = A
    ).

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% INSERT
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

max_heap_insert(A, Key, NewHeap) :-
    append(A, [-1000000000], TempHeap),
    length(TempHeap, HeapSize),
    Index is HeapSize - 1,
    max_heap_increase_key(TempHeap, Index, Key, NewHeap).

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% EXTRACT MAX
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

extract_max([Max], Max, []).

extract_max(A, Max, NewHeap) :-
    A = [Max | _],
    append(Front, [Last], A),
    Front = [_ | Rest],
    TempHeap = [Last | Rest],
    length(TempHeap, HeapSize),
    max_heapify(TempHeap, HeapSize, 0, NewHeap).

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% INCREASE KEY
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

max_heap_increase_key(A, I, Key, Heap) :-
    nth0(I, A, Current),
    Key >= Current,
    replace(A, I, Key, TempHeap),
    bubble_up(TempHeap, I, Heap).

bubble_up(A, 0, A).

bubble_up(A, I, Heap) :-
    parent(I, P),
    nth0(I, A, AI),
    nth0(P, A, AP),

    (
        AP < AI
    ->
        swap(A, I, P, TempHeap),
        bubble_up(TempHeap, P, Heap)
    ;
        Heap = A
    ).

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% GETTER METHODEN
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

get_heap(A, A).

get_sorted_array(A, Sorted) :-
    heap_sort(A, [], Sorted).

heap_sort([], Acc, Sorted) :-
    reverse(Acc, Sorted).

heap_sort(A, Acc, Sorted) :-
    extract_max(A, Max, NewHeap),
    append(Acc, [Max], NewAcc),
    heap_sort(NewHeap, NewAcc, Sorted).

get_minimum(A, Min) :-

    length(A, HeapSize),

    Start is HeapSize // 2 - 1,

    findall(
        X,
        (
            nth0(I, A, X),
            I >= Start
        ),
        Leaves
    ),

    min_list(Leaves, Min).

get_maximum([Max | _], Max).

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% HILFSFUNKTIONEN
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

left(I, L) :-
    L is 2 * I + 1.

right(I, R) :-
    R is 2 * I + 2.

parent(I, P) :-
    P is (I - 1) // 2.

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% LISTENOPERATIONEN
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

replace([_ | T], 0, X, [X | T]).

replace([H | T], I, X, [H | R]) :-
    I > 0,
    I1 is I - 1,
    replace(T, I1, X, R).

swap(A, I, J, Result) :-

    nth0(I, A, ElemI),
    nth0(J, A, ElemJ),

    replace(A, I, ElemJ, Temp),
    replace(Temp, J, ElemI, Result).

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% MAIN
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

main :-
    build_max_heap([5,2,1,3,7,8], Heap),
    write('Heap: '),
    writeln(Heap),
    get_sorted_array(Heap, Sorted),
    write('Sorted: '),
    writeln(Sorted),
    get_minimum(Heap, Min),
    write('Minimum: '),
    writeln(Min),
    get_maximum(Heap, Max),
    write('Maximum: '),
    writeln(Max).