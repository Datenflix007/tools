/**
 * Eingabe:    Ein Array A mit ganzzahligen Werten in [0..k] sowie Maximalwert k.
 * Ausgabe:    Ein neues Array B mit den Elementen aus A aufsteigend sortiert.
 */
import java.util.Arrays;

public class Countingsort {

    /** HAUPTMETHODEN */

    public int[] countingsort(int[] A, int k) {

        int n = A.length;
        int[] C = new int[k + 1];
        int[] B = new int[n];

        for (int i = 0; i <= k; i++) {
            C[i] = 0;
        }

        for (int j = 0; j < n; j++) {
            C[A[j]] = C[A[j]] + 1;
        }

        for (int i = 1; i <= k; i++) {
            C[i] = C[i] + C[i - 1];
        }

        for (int j = n - 1; j >= 0; j--) {
            B[C[A[j]] - 1] = A[j];
            C[A[j]] = C[A[j]] - 1;
        }

        return B;
    }

    public static void main(String[] args) {
        int[] A = {2, 5, 3, 0, 2, 3, 0, 3};
        Countingsort cs = new Countingsort();
        System.out.println(Arrays.toString(cs.countingsort(A, 5)));
    }
}
