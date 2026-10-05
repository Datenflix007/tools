<?php

class Task
{
    public function __construct(
        public string $name,
        public int $priority
    ) {}

    public function __toString(): string
    {
        return "[{$this->priority}] {$this->name}";
    }
}

// PHP SplMaxHeap: compare() bestimmt die Ordnung.
// Gibt positiven Wert zurück, wenn $a vor $b stehen soll.
class TaskQueue extends \SplMaxHeap
{
    protected function compare(mixed $a, mixed $b): int
    {
        return $a->priority <=> $b->priority;
    }
}

$queue = new TaskQueue();
$queue->insert(new Task('E-Mails beantworten', 2));
$queue->insert(new Task('Server neu starten', 10));
$queue->insert(new Task('Hauspost wegbringen', 7));
$queue->insert(new Task('Essensmarken besorgen', 1));
$queue->insert(new Task('Backup durchführen', 5));

echo 'Nächste Aufgabe: ' . $queue->top() . "\n\n";
echo "Tasks werden verarbeitet:\n";
while (!$queue->isEmpty()) {
    echo 'Bearbeite: ' . $queue->extract() . "\n";
}
