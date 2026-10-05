import java.util.Arrays;

public class Heapsort {

    public int[] heapsort(int[] A) {
        MaxHeap maxHeap = new MaxHeap(A);
        for (int i = A.length - 1; i > 0; i--) {
            int temp = A[0];
            A[0] = A[i];
            A[i] = temp;
            maxHeap.heapSize--;
            maxHeap.maxHeapify(0);
        }
        return A;
    }

    public static void main(String[] args) {
        int[] A = {3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5};
        Heapsort heapsort = new Heapsort();
        System.out.println(Arrays.toString(heapsort.heapsort(A)));
    }
}
