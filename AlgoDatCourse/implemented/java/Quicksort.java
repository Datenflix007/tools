/**
 * Eingabe:    Ein unsortiertes Array A sowie linker Index p und rechter Index r.
 * Ausgabe:    Array A[p..r] aufsteigend sortiert (in-place).
 */
import java.util.Arrays;

public class Quicksort {

    /** HAUPTMETHODEN */

    public void quicksort(int[] A, int p, int r) {

        if (p < r) {

            int q = partition(A, p, r);

            quicksort(A, p, q - 1);
            quicksort(A, q + 1, r);
        }
    }

    public int partition(int[] A, int p, int r) {

        int x = A[r];
        int i = p - 1;

        for (int j = p; j <= r - 1; j++) {
            if (A[j] <= x) {
                i++;
                int temp = A[i]; A[i] = A[j]; A[j] = temp;
            }
        }

        int temp = A[i + 1]; A[i + 1] = A[r]; A[r] = temp;

        return i + 1;
    }

    public static void main(String[] args) {
        int[] A = {3, 1, 4, 1, 5, 9, 2, 6};
        Quicksort qs = new Quicksort();
        qs.quicksort(A, 0, A.length - 1);
        System.out.println(Arrays.toString(A));
    }
}
