/**
 * Eingabe:    Ein unsortiertes Array A von Zahlen, das noch keine Max-Heap-Eigenschaft hat.
 * Ausgabe:    Ein Array A, das als Max-Heap organisiert ist.
 * Methoden:   buildMaxHeap(), maxHeapify(i), maxHeapInsert(key), maxHeapIncreaseKey(i, key), extractMax()
 */
import java.util.Arrays;

public class MaxHeap {
    private int[] A;
    public int heapSize;

    MaxHeap(int[] A) {
        this.A = A;
        this.heapSize = A.length;
        buildMaxHeap();
    }

    /** HAUPTMETHODEN */

    public void buildMaxHeap() {
        heapSize = A.length;
        for (int i = heapSize / 2 - 1; i >= 0; i--) {
            maxHeapify(i);
        }
    }

    public void maxHeapify(int i) {
        int l = left(i);
        int r = right(i);
        int largest;

        if (l < heapSize && A[l] > A[i]) {
            largest = l;
        } else {
            largest = i;
        }

        if (r < heapSize && A[r] > A[largest]) {
            largest = r;
        }

        if (largest != i) {
            int temp = A[i];
            A[i] = A[largest];
            A[largest] = temp;
            maxHeapify(largest);
        }
    }

    public void maxHeapInsert(int key) {
        heapSize = A.length + 1;
        A = Arrays.copyOf(A, heapSize);
        A[heapSize - 1] = Integer.MIN_VALUE;
        maxHeapIncreaseKey(heapSize - 1, key);
    }

    public int extractMax() {
        if (heapSize == 0) {throw new IllegalStateException("Heap is empty"); }

        int max = A[0];
        A[0] = A[heapSize - 1];
        heapSize--;
        A = Arrays.copyOf(A, heapSize);
        if (heapSize > 0) {
            maxHeapify(0);
        }
        return max;
    }

    public void maxHeapIncreaseKey(int i, int key) {
        if (key < A[i]) {throw new IllegalArgumentException("Error: new key is smaller than current key"); }
       
        A[i] = key;
        while (i > 0 && A[parent(i)] < A[i]) {
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
    public int[] getHeap() { return A; }
    public int[] getSortedArray() {
        int[] backupA = Arrays.copyOf(A, heapSize);
        int backupHeapSize = heapSize;
        int[] sortedArray = new int[heapSize];

        for (int i = heapSize - 1; i >= 0; i--) {
            sortedArray[i] = extractMax();
        }

        A = backupA;
        heapSize = backupHeapSize;
        return sortedArray;
    }

    public int getMinimum() {
        if (heapSize == 0) { throw new IllegalStateException("Heap is empty"); }

        int min = A[0];
        for (int i = heapSize/2-1; i < heapSize; i++) {
            if (A[i] < min) {
                min = A[i];
            }
        }
        return min;
    }
    public int getMaximum() {
        if (heapSize == 0) { throw new IllegalStateException("Heap is empty"); }
        return A[0];
    }
    

    public static void main(String[] args) {
        MaxHeap maxHeap = new MaxHeap(new int[]{5,2,1,3,7,8});
        System.out.println(Arrays.toString(maxHeap.getHeap()));
        System.out.println(Arrays.toString(maxHeap.getSortedArray()));
        System.out.println(maxHeap.getMinimum());
        System.out.println(maxHeap.getMaximum());
    }
}