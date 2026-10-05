/*
 * Eingabe:    Eine Liste ganzzahliger Werte sowie Anzahl Stellen d (Basis 10).
 * Ausgabe:    Eine aufsteigend sortierte Liste (LSD-Radixsort).
 */

:- use_module(library(lists)).

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% RADIXSORT (LSD)
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

radixsort(A, D, Sorted) :-
    radixsort_pass(A, 1, D, Sorted).

radixsort_pass(A, I, D, A) :-
    I > D, !.

radixsort_pass(A, I, D, Sorted) :-
    countingsort_by_digit(A, 10, I, Temp),
    I1 is I + 1,
    radixsort_pass(Temp, I1, D, Sorted).

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% STABILE SORTIERUNG NACH STELLE I
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

countingsort_by_digit(A, Basis, Stelle, Sorted) :-

    maplist(key_by_digit(Stelle, Basis), A, Keyed),
    keysort(Keyed, SortedKeyed),
    pairs_values(SortedKeyed, Sorted).

key_by_digit(Stelle, Basis, X, Key-X) :-
    Key is (X // Basis ^ (Stelle - 1)) mod Basis.

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% HILFSFUNKTIONEN
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

get_digit(N, Stelle, Basis, Digit) :-
    Digit is (N // Basis ^ (Stelle - 1)) mod Basis.

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% MAIN
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

main :-
    A = [329, 457, 657, 839, 436, 720, 355],
    radixsort(A, 3, Sorted),
    write('Sorted: '),
    writeln(Sorted).
