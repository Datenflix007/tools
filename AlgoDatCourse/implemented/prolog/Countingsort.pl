/*
 * Eingabe:    Eine Liste ganzzahliger Werte in [0..K] sowie Maximalwert K.
 * Ausgabe:    Eine aufsteigend sortierte Liste.
 */

:- use_module(library(lists)).

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% COUNTINGSORT
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

countingsort(A, K, B) :-

    numlist(0, K, Keys),
    maplist(count_val(A), Keys, Counts),
    expand_counts(Keys, Counts, B).

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% SCHRITT 1: ZAEHLEN – C[i] = Anzahl Vorkommen von i
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

count_val(A, Key, Count) :-
    include(=(Key), A, Matches),
    length(Matches, Count).

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% SCHRITT 2: EXPANDIEREN – Zaehler in Ausgabeliste umwandeln
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

expand_counts([], [], []).

expand_counts([_ | Ks], [0 | Cs], Result) :- !,
    expand_counts(Ks, Cs, Result).

expand_counts([K | Ks], [N | Cs], [K | Rest]) :-
    N > 0,
    N1 is N - 1,
    expand_counts([K | Ks], [N1 | Cs], Rest).

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% MAIN
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

main :-
    A = [2, 5, 3, 0, 2, 3, 0, 3],
    countingsort(A, 5, Sorted),
    write('Sorted: '),
    writeln(Sorted).
