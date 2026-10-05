class Countingsort:

    def countingsort(self, A, k):

        n = len(A)
        C = [0] * (k + 1)
        B = [0] * n

        for j in range(n):
            C[A[j]] = C[A[j]] + 1

        for i in range(1, k + 1):
            C[i] = C[i] + C[i - 1]

        for j in range(n - 1, -1, -1):
            B[C[A[j]] - 1] = A[j]
            C[A[j]] = C[A[j]] - 1

        return B


if __name__ == "__main__":

    A = [2, 5, 3, 0, 2, 3, 0, 3]
    cs = Countingsort()
    print(cs.countingsort(A, 5))
