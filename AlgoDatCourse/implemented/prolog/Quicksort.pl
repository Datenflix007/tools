/*
 * Eingabe:    Eine unsortierte Liste von Zahlen.
 * Ausgabe:    Eine aufsteigend sortierte Liste.
 */

:- use_module(library(lists)).

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% QUICKSORT
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

quicksort([], []).

quicksort([Pivot | Rest], Sorted) :-

    partition(Pivot, Rest, Less, Greater),
    quicksort(Less, SortedLess),
    quicksort(Greater, SortedGreater),
    append(SortedLess, [Pivot | SortedGreater], Sorted).

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% PARTITION
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

partition(_, [], [], []).

partition(Pivot, [H | T], [H | Less], Greater) :-
    H =< Pivot, !,
    partition(Pivot, T, Less, Greater).

partition(Pivot, [H | T], Less, [H | Greater]) :-
    partition(Pivot, T, Less, Greater).

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% MAIN
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

main :-
    A = [3, 1, 4, 1, 5, 9, 2, 6],
    quicksort(A, Sorted),
    write('Sorted: '),
    writeln(Sorted).
