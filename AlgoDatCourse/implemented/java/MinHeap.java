import java.util.Arrays;

/**
 * Eingabe:    Ein unsortiertes Array A von Zahlen.
 * Ausgabe:    Ein Array A, das als Min-Heap organisiert ist.
 */



public class MinHeap {

    private int[] A;
    private int heapSize;

    MinHeap(int[] A) {
        this.A = A;
        this.heapSize = A.length;
        buildMinHeap();
    }

    /** HAUPTMETHODEN */

    public void buildMinHeap() {
        heapSize = A.length;

        for (int i = heapSize / 2 - 1; i >= 0; i--) {
            minHeapify(i);
        }
    }

    public void minHeapify(int i) {
        int l = left(i);
        int r = right(i);

        int smallest;

        if (l < heapSize && A[l] < A[i]) {
            smallest = l;
        } else {
            smallest = i;
        }

        if (r < heapSize && A[r] < A[smallest]) {
            smallest = r;
        }

        if (smallest != i) {
            int temp = A[i];
            A[i] = A[smallest];
            A[smallest] = temp;

            minHeapify(smallest);
        }
    }

    public void minHeapInsert(int key) {
        heapSize = A.length + 1;

        A = Arrays.copyOf(A, heapSize);

        A[heapSize - 1] = Integer.MAX_VALUE;

        minHeapDecreaseKey(heapSize - 1, key);
    }

    public int extractMin() {
        if (heapSize == 0) {
            throw new IllegalStateException("Heap is empty");
        }

        int min = A[0];

        A[0] = A[heapSize - 1];

        heapSize--;

        A = Arrays.copyOf(A, heapSize);

        if (heapSize > 0) {
            minHeapify(0);
        }

        return min;
    }

    public void minHeapDecreaseKey(int i, int key) {

        if (key > A[i]) {
            throw new IllegalArgumentException(
                "Error: new key is larger than current key"
            );
        }

        A[i] = key;

        while (i > 0 && A[parent(i)] > A[i]) {

            int temp = A[i];
            A[i] = A[parent(i)];
            A[parent(i)] = temp;

            i = parent(i);
        }
    }

    /** HILFSFUNKTIONEN IM BAUM */

    private int left(int i) {
        return 2 * i + 1;
    }

    private int right(int i) {
        return 2 * i + 2;
    }

    private int parent(int i) {
        return (i - 1) / 2;
    }

    /** GETTER METHODEN */

    public int[] getHeap() {
        return A;
    }

    public int[] getSortedArray() {

        int[] backupA = Arrays.copyOf(A, heapSize);
        int backupHeapSize = heapSize;

        int[] sortedArray = new int[heapSize];

        for (int i = 0; i < sortedArray.length; i++) {
            sortedArray[i] = extractMin();
        }

        A = backupA;
        heapSize = backupHeapSize;

        return sortedArray;
    }

    public int getMinimum() {

        if (heapSize == 0) {
            throw new IllegalStateException("Heap is empty");
        }

        return A[0];
    }

    public int getMaximum() {

        if (heapSize == 0) {
            throw new IllegalStateException("Heap is empty");
        }

        int max = A[heapSize / 2];

        for (int i = heapSize / 2; i < heapSize; i++) {

            if (A[i] > max) {
                max = A[i];
            }
        }

        return max;
    }

    public static void main(String[] args) {

        MinHeap minHeap = new MinHeap(new int[]{5, 2, 1, 3, 7, 8});

        System.out.println(Arrays.toString(minHeap.getHeap()));

        System.out.println(Arrays.toString(minHeap.getSortedArray()));

        System.out.println(minHeap.getMinimum());

        System.out.println(minHeap.getMaximum());
    }
}