/*
 * Eingabe:    Eine unsortierte Liste von Zahlen.
 * Ausgabe:    Eine aufsteigend sortierte Liste.
 */

:- use_module(library(lists)).

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% SELECTIONSORT
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

selectionsort([], []).

selectionsort(List, [Min | Sorted]) :-

    min_list(List, Min),
    delete_first(Min, List, Rest),
    selectionsort(Rest, Sorted).

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% HILFSFUNKTIONEN
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

delete_first(X, [X | T], T) :- !.

delete_first(X, [H | T], [H | R]) :-
    delete_first(X, T, R).

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% MAIN
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

main :-
    A = [3, 1, 4, 1, 5, 9, 2, 6],
    selectionsort(A, Sorted),
    write('Sorted: '),
    writeln(Sorted).
