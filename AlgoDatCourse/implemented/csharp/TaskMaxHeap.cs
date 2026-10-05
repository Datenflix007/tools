using System;

public class TaskManual
{
    public string Name;
    public int Priority;

    public TaskManual(string name, int priority)
    {
        Name = name;
        Priority = priority;
    }

    public override string ToString() => $"[{Priority}] {Name}";
}

public class TaskMaxHeap
{
    private TaskManual[] _heap;
    private int _size;

    public TaskMaxHeap(int capacity = 16)
    {
        _heap = new TaskManual[capacity];
        _size = 0;
    }

    public void Insert(TaskManual task)
    {
        if (_size == _heap.Length)
            Array.Resize(ref _heap, _heap.Length * 2);
        _heap[_size] = task;
        BubbleUp(_size++);
    }

    public TaskManual ExtractMax()
    {
        if (_size == 0) throw new InvalidOperationException("Heap leer");
        var max = _heap[0];
        _heap[0] = _heap[--_size];
        HeapifyDown(0);
        return max;
    }

    public TaskManual Peek() =>
        _size > 0 ? _heap[0] : throw new InvalidOperationException("Heap leer");

    public bool IsEmpty => _size == 0;

    private void BubbleUp(int i)
    {
        while (i > 0)
        {
            int p = (i - 1) / 2;
            if (_heap[p].Priority < _heap[i].Priority) { Swap(p, i); i = p; }
            else break;
        }
    }

    private void HeapifyDown(int i)
    {
        while (true)
        {
            int l = 2 * i + 1, r = 2 * i + 2, largest = i;
            if (l < _size && _heap[l].Priority > _heap[largest].Priority) largest = l;
            if (r < _size && _heap[r].Priority > _heap[largest].Priority) largest = r;
            if (largest == i) break;
            Swap(i, largest); i = largest;
        }
    }

    private void Swap(int a, int b) => (_heap[a], _heap[b]) = (_heap[b], _heap[a]);

    public static void Main()
    {
        var queue = new TaskMaxHeap();
        queue.Insert(new TaskManual("E-Mails", 2));
        queue.Insert(new TaskManual("Backup", 5));
        queue.Insert(new TaskManual("Server Neustart", 10));
        queue.Insert(new TaskManual("Monitoring", 3));

        Console.WriteLine("Tasks werden verarbeitet:");
        while (!queue.IsEmpty)
            Console.WriteLine(queue.ExtractMax());
    }
}
