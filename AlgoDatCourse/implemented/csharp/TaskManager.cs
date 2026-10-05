using System;
using System.Collections.Generic;

public class Task
{
    public string Name;
    public int Priority;

    public Task(string name, int priority) { Name = name; Priority = priority; }

    public override string ToString() => $"[{Priority}] {Name}";
}

public class TaskManager
{
    // .NET 6+: PriorityQueue<TElement, TPriority>
    // Standardmäßig ein MinHeap (niedrigste TPriority zuerst).
    // Negierte Priorität als TPriority → höchste Priorität zuerst.
    private readonly PriorityQueue<Task, int> _queue = new();

    public void AddTask(string name, int priority)
        => _queue.Enqueue(new Task(name, priority), -priority);

    public Task GetNextTask() => _queue.Dequeue();
    public Task PeekTask()    => _queue.Peek();
    public bool IsEmpty       => _queue.Count == 0;

    public static void Main()
    {
        var manager = new TaskManager();
        manager.AddTask("E-Mails beantworten", 2);
        manager.AddTask("Server neu starten", 10);
        manager.AddTask("Hauspost wegbringen", 7);
        manager.AddTask("Essensmarken besorgen", 1);
        manager.AddTask("Backup durchführen", 5);

        Console.WriteLine("Nächste Aufgabe: " + manager.PeekTask());
        Console.WriteLine();
        while (!manager.IsEmpty)
            Console.WriteLine("Bearbeite: " + manager.GetNextTask());
    }
}
