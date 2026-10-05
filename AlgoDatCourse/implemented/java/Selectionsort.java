/**
 * Eingabe:    Ein unsortiertes Array A von Zahlen.
 * Ausgabe:    Array A aufsteigend sortiert (in-place).
 */
import java.util.Arrays;

public class Selectionsort {

    /** HAUPTMETHODEN */

    public void selectionsort(int[] A) {

        for (int i = 0; i < A.length - 1; i++) {

            int min = i;

            for (int j = i + 1; j < A.length; j++) {
                if (A[j] < A[min]) {
                    min = j;
                }
            }

            int temp = A[i];
            A[i] = A[min];
            A[min] = temp;
        }
    }

    public static void main(String[] args) {
        int[] A = {3, 1, 4, 1, 5, 9, 2, 6};
        Selectionsort s = new Selectionsort();
        s.selectionsort(A);
        System.out.println(Arrays.toString(A));
    }
}
