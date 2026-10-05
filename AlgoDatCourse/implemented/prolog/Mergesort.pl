/*
 * Eingabe:    Eine unsortierte Liste von Zahlen.
 * Ausgabe:    Eine aufsteigend sortierte Liste.
 */

:- use_module(library(lists)).

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% MERGESORT
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

mergesort([], []).
mergesort([X], [X]).

mergesort(List, Sorted) :-

    length(List, Len),
    Len > 1,
    Half is Len // 2,
    length(Left, Half),
    append(Left, Right, List),
    mergesort(Left, SortedLeft),
    mergesort(Right, SortedRight),
    merge_sorted(SortedLeft, SortedRight, Sorted).

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% MERGE
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

merge_sorted([], R, R).
merge_sorted(L, [], L).

merge_sorted([H1 | T1], [H2 | T2], [H1 | Merged]) :-
    H1 =< H2, !,
    merge_sorted(T1, [H2 | T2], Merged).

merge_sorted([H1 | T1], [H2 | T2], [H2 | Merged]) :-
    merge_sorted([H1 | T1], T2, Merged).

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% MAIN
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

main :-
    A = [5, 2, 4, 6, 1, 3],
    mergesort(A, Sorted),
    write('Sorted: '),
    writeln(Sorted).
