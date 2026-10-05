<?php

class TaskManual
{
    public string $name;
    public int $priority;

    public function __construct(string $name, int $priority)
    {
        $this->name     = $name;
        $this->priority = $priority;
    }

    public function __toString(): string
    {
        return "[{$this->priority}] {$this->name}";
    }
}

class TaskMaxHeap
{
    private array $heap = [];
    private int $size = 0;

    public function insert(TaskManual $task): void
    {
        $this->heap[$this->size] = $task;
        $i = $this->size++;
        while ($i > 0) {
            $p = intdiv($i - 1, 2);
            if ($this->heap[$p]->priority < $this->heap[$i]->priority) {
                [$this->heap[$p], $this->heap[$i]] = [$this->heap[$i], $this->heap[$p]];
                $i = $p;
            } else {
                break;
            }
        }
    }

    public function extractMax(): TaskManual
    {
        if ($this->size === 0) {
            throw new \UnderflowException('Heap leer');
        }
        $max = $this->heap[0];
        $this->heap[0] = $this->heap[--$this->size];
        $this->heapifyDown(0);
        return $max;
    }

    public function isEmpty(): bool { return $this->size === 0; }

    private function heapifyDown(int $i): void
    {
        while (true) {
            $l = 2 * $i + 1;
            $r = 2 * $i + 2;
            $largest = $i;
            if ($l < $this->size && $this->heap[$l]->priority > $this->heap[$largest]->priority) {
                $largest = $l;
            }
            if ($r < $this->size && $this->heap[$r]->priority > $this->heap[$largest]->priority) {
                $largest = $r;
            }
            if ($largest === $i) break;
            [$this->heap[$i], $this->heap[$largest]] = [$this->heap[$largest], $this->heap[$i]];
            $i = $largest;
        }
    }
}

$queue = new TaskMaxHeap();
$queue->insert(new TaskManual('E-Mails', 2));
$queue->insert(new TaskManual('Backup', 5));
$queue->insert(new TaskManual('Server Neustart', 10));
$queue->insert(new TaskManual('Monitoring', 3));

echo "Tasks werden verarbeitet:\n";
while (!$queue->isEmpty()) {
    echo $queue->extractMax() . "\n";
}
