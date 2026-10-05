% Prioritätswarteschlange in Prolog
% Darstellung als absteigend sortierte Liste: [task(Priorität, Name), ...]
% Höhere Zahl = höhere Priorität = wird zuerst verarbeitet.

% Leere Warteschlange
pq_empty([]).

% Element einfügen (sortiert nach absteigender Priorität)
pq_insert(Task, [], [Task]) :- !.
pq_insert(task(P1, N1), [task(P2, N2)|Rest], [task(P1, N1), task(P2, N2)|Rest]) :-
    P1 >= P2, !.
pq_insert(task(P1, N1), [task(P2, N2)|Rest], [task(P2, N2)|Sorted]) :-
    pq_insert(task(P1, N1), Rest, Sorted).

% Höchste Priorität lesen (ohne Entnahme)
pq_peek([Top|_], Top).

% Höchste Priorität entnehmen
pq_extract_max([Max|Rest], Max, Rest).

% Hilfsprädikat: alle Tasks verarbeiten
process_all([]) :- !.
process_all(PQ) :-
    pq_extract_max(PQ, task(P, N), Rest),
    format("  [~w] ~w~n", [P, N]),
    process_all(Rest).

% Beispiel
:- initialization(main, main).
main :-
    pq_empty(PQ0),
    pq_insert(task(2,  "E-Mails"),        PQ0, PQ1),
    pq_insert(task(5,  "Backup"),          PQ1, PQ2),
    pq_insert(task(10, "Server Neustart"), PQ2, PQ3),
    pq_insert(task(3,  "Monitoring"),      PQ3, PQ4),
    write("Tasks werden verarbeitet:"), nl,
    process_all(PQ4).
