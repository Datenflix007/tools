class MinHeap:

    def __init__(self, A):

        self.A = A
        self.heapSize = len(A)

        self.buildMinHeap()

    """ HAUPTMETHODEN """

    def buildMinHeap(self):

        self.heapSize = len(self.A)

        for i in range(self.heapSize // 2 - 1, -1, -1):
            self.minHeapify(i)

    def minHeapify(self, i):

        l = self.left(i)
        r = self.right(i)

        if l < self.heapSize and self.A[l] < self.A[i]:
            smallest = l
        else:
            smallest = i

        if r < self.heapSize and self.A[r] < self.A[smallest]:
            smallest = r

        if smallest != i:

            temp = self.A[i]
            self.A[i] = self.A[smallest]
            self.A[smallest] = temp

            self.minHeapify(smallest)

    def minHeapInsert(self, key):

        self.heapSize = len(self.A) + 1

        self.A.append(float("inf"))

        self.minHeapDecreaseKey(self.heapSize - 1, key)

    def extractMin(self):

        if self.heapSize == 0:
            raise Exception("Heap is empty")

        minimum = self.A[0]

        self.A[0] = self.A[self.heapSize - 1]

        self.heapSize -= 1

        self.A.pop()

        if self.heapSize > 0:
            self.minHeapify(0)

        return minimum

    def minHeapDecreaseKey(self, i, key):

        if key > self.A[i]:
            raise Exception(
                "Error: new key is larger than current key"
            )

        self.A[i] = key

        while i > 0 and self.A[self.parent(i)] > self.A[i]:

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

        for i in range(len(sortedArray)):
            sortedArray[i] = self.extractMin()

        self.A = backupA
        self.heapSize = backupHeapSize

        return sortedArray

    def getMinimum(self):

        if self.heapSize == 0:
            raise Exception("Heap is empty")

        return self.A[0]

    def getMaximum(self):

        if self.heapSize == 0:
            raise Exception("Heap is empty")

        maximum = self.A[self.heapSize // 2]

        for i in range(self.heapSize // 2, self.heapSize):

            if self.A[i] > maximum:
                maximum = self.A[i]

        return maximum


if __name__ == "__main__":

    minHeap = MinHeap([5, 2, 1, 3, 7, 8])
    print(minHeap.getHeap())
    print(minHeap.getSortedArray())
    print(minHeap.getMinimum())
    print(minHeap.getMaximum())