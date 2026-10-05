class Mergesort:

    def mergesort(self, A, p, r):

        if p < r:

            q = (p + r) // 2

            self.mergesort(A, p, q)
            self.mergesort(A, q + 1, r)
            self.merge(A, p, q, r)

    def merge(self, A, p, q, r):

        n1 = q - p + 1
        n2 = r - q

        L = A[p : p + n1] + [float('inf')]
        R = A[q + 1 : q + 1 + n2] + [float('inf')]

        i = 0
        j = 0

        for k in range(p, r + 1):
            if L[i] <= R[j]:
                A[k] = L[i]
                i += 1
            else:
                A[k] = R[j]
                j += 1


if __name__ == "__main__":

    A = [5, 2, 4, 6, 1, 3]
    ms = Mergesort()
    ms.mergesort(A, 0, len(A) - 1)
    print(A)
