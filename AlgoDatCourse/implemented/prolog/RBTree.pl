% Funktionaler Rot-Schwarz-Baum.
% Darstellung: empty oder node(Color, Left, Key, Value, Right).

color(empty, black).
color(node(Color, _, _, _, _), Color).

search(node(_, Left, Key, _, _), Query, Value) :-
    Query @< Key,
    search(Left, Query, Value).
search(node(_, _, Key, Value, _), Key, Value).
search(node(_, _, Key, _, Right), Query, Value) :-
    Query @> Key,
    search(Right, Query, Value).

minimum(node(_, empty, Key, Value, _), Key, Value).
minimum(node(_, Left, _, _, _), Key, Value) :-
    minimum(Left, Key, Value).

maximum(node(_, _, Key, Value, empty), Key, Value).
maximum(node(_, _, _, _, Right), Key, Value) :-
    maximum(Right, Key, Value).

insert(Tree, Key, Value, Result) :-
    insert_red(Tree, Key, Value, Temp),
    blacken(Temp, Result).

insert_red(empty, Key, Value, node(red, empty, Key, Value, empty)).
insert_red(node(Color, Left, Key, _, Right), Key, Value,
           node(Color, Left, Key, Value, Right)).
insert_red(node(Color, Left, Key, V, Right), NewKey, NewValue, Result) :-
    NewKey @< Key,
    insert_red(Left, NewKey, NewValue, NewLeft),
    balance(node(Color, NewLeft, Key, V, Right), Result).
insert_red(node(Color, Left, Key, V, Right), NewKey, NewValue, Result) :-
    NewKey @> Key,
    insert_red(Right, NewKey, NewValue, NewRight),
    balance(node(Color, Left, Key, V, NewRight), Result).

blacken(empty, empty).
blacken(node(_, L, K, V, R), node(black, L, K, V, R)).

% Vier symmetrische Rotationsfaelle nach Okasaki.
balance(node(black, node(red, node(red, A, XK, XV, B), YK, YV, C), ZK, ZV, D),
        node(red, node(black, A, XK, XV, B), YK, YV, node(black, C, ZK, ZV, D))) :- !.
balance(node(black, node(red, A, XK, XV, node(red, B, YK, YV, C)), ZK, ZV, D),
        node(red, node(black, A, XK, XV, B), YK, YV, node(black, C, ZK, ZV, D))) :- !.
balance(node(black, A, XK, XV, node(red, node(red, B, YK, YV, C), ZK, ZV, D)),
        node(red, node(black, A, XK, XV, B), YK, YV, node(black, C, ZK, ZV, D))) :- !.
balance(node(black, A, XK, XV, node(red, B, YK, YV, node(red, C, ZK, ZV, D))),
        node(red, node(black, A, XK, XV, B), YK, YV, node(black, C, ZK, ZV, D))) :- !.
balance(Tree, Tree).

inorder(empty, []).
inorder(node(_, Left, Key, Value, Right), Items) :-
    inorder(Left, Ls),
    inorder(Right, Rs),
    append(Ls, [Key-Value | Rs], Items).

from_list([], empty).
from_list([Key-Value | Rest], Tree) :-
    from_list(Rest, Temp),
    insert(Temp, Key, Value, Tree).

delete(Tree, Key, Result) :-
    inorder(Tree, Items),
    exclude_key(Key, Items, Remaining),
    from_list(Remaining, Result).

exclude_key(_, [], []).
exclude_key(Key, [Key-_|Rest], Result) :-
    exclude_key(Key, Rest, Result).
exclude_key(Key, [ItemKey-Value|Rest], [ItemKey-Value|Result]) :-
    Key \= ItemKey,
    exclude_key(Key, Rest, Result).

successor(Tree, Key, SuccKey, SuccValue) :-
    inorder(Tree, Items),
    first_greater(Items, Key, SuccKey, SuccValue).

predecessor(Tree, Key, PredKey, PredValue) :-
    inorder(Tree, Items),
    last_less(Items, Key, none, PredKey-PredValue).

first_greater([K-V|_], Key, K, V) :- K @> Key, !.
first_greater([_|Rest], Key, K, V) :- first_greater(Rest, Key, K, V).

last_less([], _, Key-Value, Key-Value) :- Key \= none.
last_less([K-V|Rest], Key, _, Result) :-
    K @< Key,
    last_less(Rest, Key, K-V, Result).
last_less([K-_|_], Key, Current, Result) :-
    K @>= Key,
    Current = Result.

demo :-
    from_list([41-'Ereignis 41', 38-'Ereignis 38', 31-'Ereignis 31',
               12-'Ereignis 12', 19-'Ereignis 19', 8-'Ereignis 8'], Tree),
    inorder(Tree, Items),
    writeln(Items),
    search(Tree, 19, Value),
    writeln(Value),
    delete(Tree, 12, SmallerTree),
    inorder(SmallerTree, SmallerItems),
    writeln(SmallerItems).
