class Heapsort:

    def heapsort(self, A):

        maxHeap = MaxHeap(A)

        for i in range(len(A) - 1, 0, -1):

            A[0], A[i] = A[i], A[0]

            maxHeap.heapSize -= 1

            maxHeap.maxHeapify(0)

        return A


if __name__ == "__main__":

    A = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5]

    heapsort = Heapsort()

    print(heapsort.heapsort(A))