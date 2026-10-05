class Radixsort:

    def radixsort(self, A, d):

        basis = 10

        for stelle in range(1, d + 1):
            A = self.countingsort_by_digit(A, basis, stelle)

        return A

    def countingsort_by_digit(self, A, basis, stelle):

        n = len(A)
        B = [0] * n
        C = [0] * basis

        for j in range(n):
            C[self.get_digit(A[j], stelle, basis)] = C[self.get_digit(A[j], stelle, basis)] + 1

        for i in range(1, basis):
            C[i] = C[i] + C[i - 1]

        for j in range(n - 1, -1, -1):
            digit = self.get_digit(A[j], stelle, basis)
            B[C[digit] - 1] = A[j]
            C[digit] = C[digit] - 1

        return B

    def get_digit(self, n, stelle, basis):
        return (n // basis ** (stelle - 1)) % basis


if __name__ == "__main__":

    A = [329, 457, 657, 839, 436, 720, 355]
    rs = Radixsort()
    print(rs.radixsort(A, 3))
