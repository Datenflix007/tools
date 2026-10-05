class MaxHeap:

    def __init__(self, A):
        self.A = A
        self.heapSize = len(A)
        self.buildMaxHeap()

    """ HAUPTMETHODEN """

    def buildMaxHeap(self):

        self.heapSize = len(self.A)

        for i in range(self.heapSize // 2 - 1, -1, -1):
            self.maxHeapify(i)

    def maxHeapify(self, i):

        l = self.left(i)
        r = self.right(i)

        if l < self.heapSize and self.A[l] > self.A[i]:
            largest = l
        else:
            largest = i

        if r < self.heapSize and self.A[r] > self.A[largest]:
            largest = r

        if largest != i:

            temp = self.A[i]
            self.A[i] = self.A[largest]
            self.A[largest] = temp

            self.maxHeapify(largest)

    def maxHeapInsert(self, key):

        self.heapSize = len(self.A) + 1

        self.A.append(float("-inf"))

        self.maxHeapIncreaseKey(self.heapSize - 1, key)

    def extractMax(self):

        if self.heapSize == 0:
            raise Exception("Heap is empty")

        maximum = self.A[0]

        self.A[0] = self.A[self.heapSize - 1]

        self.heapSize -= 1

        self.A.pop()

        if self.heapSize > 0:
            self.maxHeapify(0)

        return maximum

    def maxHeapIncreaseKey(self, i, key):

        if key < self.A[i]:
            raise Exception(
                "Error: new key is smaller than current key"
            )

        self.A[i] = key

        while i > 0 and self.A[self.parent(i)] < self.A[i]:

            temp = self.A[i]
            self.A[i] = self.A[self.parent(i)]
            self.A[self.parent(i)] = temp

            i = self.parent(i)

    """ HILFSFUNKTIONEN IM BAUM """

    def left(self, i):
        return 2 * i + 1

    def right(self, i):
        return 2 * i + 2

    def parent(self, i):
        return (i - 1) // 2

    """ GETTER METHODEN """

    def getHeap(self):
        return self.A

    def getSortedArray(self):

        backupA = self.A.copy()
        backupHeapSize = self.heapSize

        sortedArray = [0] * self.heapSize

        for i in range(self.heapSize - 1, -1, -1):
            sortedArray[i] = self.extractMax()

        self.A = backupA
        self.heapSize = backupHeapSize

        return sortedArray

    def getMinimum(self):

        if self.heapSize == 0:
            raise Exception("Heap is empty")

        minimum = self.A[0]

        for i in range(self.heapSize // 2 - 1, self.heapSize):

            if self.A[i] < minimum:
                minimum = self.A[i]

        return minimum

    def getMaximum(self):

        if self.heapSize == 0:
            raise Exception("Heap is empty")

        return self.A[0]


if __name__ == "__main__":

    maxHeap = MaxHeap([5, 2, 1, 3, 7, 8])
    print(maxHeap.getHeap())
    print(maxHeap.getSortedArray())
    print(maxHeap.getMinimum())
    print(maxHeap.getMaximum())