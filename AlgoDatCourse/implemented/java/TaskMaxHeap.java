import java.util.Arrays;

public class TaskMaxHeap {

    private TaskManual[] heap;
    private int heapSize;

    public TaskMaxHeap(int capacity) {
        heap = new TaskManual[capacity];
        heapSize = 0;
    }

    // =========================
    // INSERT
    // =========================

    public void insert(TaskManual task) {

        // Array vergrößern falls voll
        if (heapSize == heap.length) {
            heap = Arrays.copyOf(heap, heap.length * 2);
        }

        heap[heapSize] = task;

        int i = heapSize;
        heapSize++;

        // Nach oben bewegen
        while (i > 0 && heap[parent(i)].priority < heap[i].priority) {

            swap(i, parent(i));

            i = parent(i);
        }
    }

    // =========================
    // EXTRACT MAX
    // =========================

    public TaskManual extractMax() {

        if (heapSize == 0) {
            throw new IllegalStateException("Heap leer");
        }

        TaskManual max = heap[0];

        heap[0] = heap[heapSize - 1];

        heapSize--;

        maxHeapify(0);

        return max;
    }

    // =========================
    // HEAPIFY
    // =========================

    private void maxHeapify(int i) {

        int left = left(i);
        int right = right(i);

        int largest = i;

        if (left < heapSize &&
            heap[left].priority > heap[largest].priority) {

            largest = left;
        }

        if (right < heapSize &&
            heap[right].priority > heap[largest].priority) {

            largest = right;
        }

        if (largest != i) {

            swap(i, largest);

            maxHeapify(largest);
        }
    }

    // =========================
    // HILFSMETHODEN
    // =========================

    private int left(int i) {
        return 2 * i + 1;
    }

    private int right(int i) {
        return 2 * i + 2;
    }

    private int parent(int i) {
        return (i - 1) / 2;
    }

    private void swap(int a, int b) {

        TaskManual temp = heap[a];
        heap[a] = heap[b];
        heap[b] = temp;
    }

    public boolean isEmpty() {
        return heapSize == 0;
    }

    // Debug-Ausgabe
    public void printHeap() {

        for (int i = 0; i < heapSize; i++) {
            System.out.println(heap[i]);
        }
    }

    public static void main(String[] args) {

        TaskMaxHeap queue = new TaskMaxHeap(10);

        queue.insert(new TaskManual("E-Mails", 2));
        queue.insert(new TaskManual("Backup", 5));
        queue.insert(new TaskManual("Server Neustart", 10));
        queue.insert(new TaskManual("Monitoring", 3));

        System.out.println("Heap:");

        queue.printHeap();

        System.out.println("\nTasks werden verarbeitet:");

        while (!queue.isEmpty()) {

            TaskManual t = queue.extractMax();

            System.out.println(t);
        }
    }
    
}
