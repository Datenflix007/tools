/*
 * Eingabe:    Eine unsortierte Liste von Zahlen.
 * Ausgabe:    Eine Liste, die als Min-Heap organisiert ist.
 */

:- use_module(library(lists)).

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% HAUPTMETHODEN
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

build_min_heap(A, Heap) :-
    length(A, HeapSize),
    Start is HeapSize // 2 - 1,
    build_heap_down(Start, HeapSize, A, Heap).

build_heap_down(-1, _, Heap, Heap).
build_heap_down(I, HeapSize, A, Heap) :-
    min_heapify(A, HeapSize, I, TempHeap),
    NextI is I - 1,
    build_heap_down(NextI, HeapSize, TempHeap, Heap).

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% MIN HEAPIFY
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

min_heapify(A, HeapSize, I, Heap) :-

    left(I, L),
    right(I, R),

    nth0(I, A, AI),

    (
        L < HeapSize,
        nth0(L, A, AL),
        AL < AI
    ->
        Smallest1 = L
    ;
        Smallest1 = I
    ),

    nth0(Smallest1, A, ASmallest1),

    (
        R < HeapSize,
        nth0(R, A, AR),
        AR < ASmallest1
    ->
        Smallest = R
    ;
        Smallest = Smallest1
    ),

    (
        Smallest =\= I
    ->
        swap(A, I, Smallest, TempHeap),
        min_heapify(TempHeap, HeapSize, Smallest, Heap)
    ;
        Heap = A
    ).

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% INSERT
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

min_heap_insert(A, Key, NewHeap) :-
    append(A, [1000000000], TempHeap),
    length(TempHeap, HeapSize),
    Index is HeapSize - 1,
    min_heap_decrease_key(TempHeap, Index, Key, NewHeap).

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% EXTRACT MIN
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

extract_min([Min], Min, []).

extract_min(A, Min, NewHeap) :-
    A = [Min | _],
    append(Front, [Last], A),
    Front = [_ | Rest],
    TempHeap = [Last | Rest],
    length(TempHeap, HeapSize),
    min_heapify(TempHeap, HeapSize, 0, NewHeap).

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% DECREASE KEY
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

min_heap_decrease_key(A, I, Key, Heap) :-
    nth0(I, A, Current),
    Key =< Current,
    replace(A, I, Key, TempHeap),
    bubble_up(TempHeap, I, Heap).

bubble_up(A, 0, A).

bubble_up(A, I, Heap) :-
    parent(I, P),
    nth0(I, A, AI),
    nth0(P, A, AP),

    (
        AP > AI
    ->
        swap(A, I, P, TempHeap),
        bubble_up(TempHeap, P, Heap)
    ;
        Heap = A
    ).

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% GETTER METHODEN
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

get_minimum([Min | _], Min).

get_maximum(A, Max) :-
    length(A, HeapSize),
    Start is HeapSize // 2,
    findall(
        X,
        (
            nth0(I, A, X),
            I >= Start
        ),
        Leaves
    ),
    max_list(Leaves, Max).

get_sorted_array(A, Sorted) :-
    heap_sort(A, [], Sorted).

heap_sort([], Acc, Acc).

heap_sort(A, Acc, Sorted) :-
    extract_min(A, Min, NewHeap),
    append(Acc, [Min], NewAcc),
    heap_sort(NewHeap, NewAcc, Sorted).

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

    build_min_heap([5,2,1,3,7,8], Heap),

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