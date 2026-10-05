/**
 * Eingabe:    Ein Array A ganzzahliger Werte sowie Anzahl Stellen d (Basis 10).
 * Ausgabe:    Array A aufsteigend sortiert (LSD-Radixsort, in-place).
 */
import java.util.Arrays;

public class Radixsort {

    /** HAUPTMETHODEN */

    public void radixsort(int[] A, int d) {

        int basis = 10;

        for (int stelle = 1; stelle <= d; stelle++) {
            countingsortByDigit(A, basis, stelle);
        }
    }

    /** HILFSMETHODEN */

    private void countingsortByDigit(int[] A, int basis, int stelle) {

        int n = A.length;
        int[] B = new int[n];
        int[] C = new int[basis];

        for (int i = 0; i < basis; i++) {
            C[i] = 0;
        }

        for (int j = 0; j < n; j++) {
            C[getDigit(A[j], stelle, basis)] = C[getDigit(A[j], stelle, basis)] + 1;
        }

        for (int i = 1; i < basis; i++) {
            C[i] = C[i] + C[i - 1];
        }

        for (int j = n - 1; j >= 0; j--) {
            int digit = getDigit(A[j], stelle, basis);
            B[C[digit] - 1] = A[j];
            C[digit] = C[digit] - 1;
        }

        System.arraycopy(B, 0, A, 0, n);
    }

    private int getDigit(int n, int stelle, int basis) {
        return (n / (int) Math.pow(basis, stelle - 1)) % basis;
    }

    public static void main(String[] args) {
        int[] A = {329, 457, 657, 839, 436, 720, 355};
        Radixsort rs = new Radixsort();
        rs.radixsort(A, 3);
        System.out.println(Arrays.toString(A));
    }
}
