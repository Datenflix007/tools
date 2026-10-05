class Selectionsort:

    def selectionsort(self, A):

        for i in range(len(A) - 1):

            min_idx = i

            for j in range(i + 1, len(A)):
                if A[j] < A[min_idx]:
                    min_idx = j

            A[i], A[min_idx] = A[min_idx], A[i]

        return A


if __name__ == "__main__":

    A = [3, 1, 4, 1, 5, 9, 2, 6]
    s = Selectionsort()
    print(s.selectionsort(A))
