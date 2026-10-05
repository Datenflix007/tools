/**
 * Eingabe:    Ein unsortiertes Array A sowie linker Index p und rechter Index r.
 * Ausgabe:    Array A[p..r] aufsteigend sortiert (in-place).
 */
import java.util.Arrays;

public class Mergesort {

    /** HAUPTMETHODEN */

    public void mergesort(int[] A, int p, int r) {

        if (p < r) {

            int q = (p + r) / 2;

            mergesort(A, p, q);
            mergesort(A, q + 1, r);
            merge(A, p, q, r);
        }
    }

    public void merge(int[] A, int p, int q, int r) {

        int n1 = q - p + 1;
        int n2 = r - q;

        int[] L = new int[n1 + 1];
        int[] R = new int[n2 + 1];

        for (int i = 0; i < n1; i++) {
            L[i] = A[p + i];
        }
        for (int j = 0; j < n2; j++) {
            R[j] = A[q + 1 + j];
        }

        L[n1] = Integer.MAX_VALUE;
        R[n2] = Integer.MAX_VALUE;

        int i = 0;
        int j = 0;

        for (int k = p; k <= r; k++) {
            if (L[i] <= R[j]) {
                A[k] = L[i];
                i++;
            } else {
                A[k] = R[j];
                j++;
            }
        }
    }

    public static void main(String[] args) {
        int[] A = {5, 2, 4, 6, 1, 3};
        Mergesort ms = new Mergesort();
        ms.mergesort(A, 0, A.length - 1);
        System.out.println(Arrays.toString(A));
    }
}
