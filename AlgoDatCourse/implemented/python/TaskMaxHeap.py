class TaskManual:
    def __init__(self, name: str, priority: int):
        self.name = name
        self.priority = priority

    def __repr__(self):
        return f"[{self.priority}] {self.name}"


class TaskMaxHeap:
    def __init__(self):
        self._heap: list[TaskManual] = []

    def insert(self, task: TaskManual) -> None:
        self._heap.append(task)
        self._bubble_up(len(self._heap) - 1)

    def extract_max(self) -> TaskManual:
        if not self._heap:
            raise IndexError("Heap ist leer")
        self._swap(0, len(self._heap) - 1)
        max_task = self._heap.pop()
        self._heapify_down(0)
        return max_task

    def peek(self) -> TaskManual:
        if not self._heap:
            raise IndexError("Heap ist leer")
        return self._heap[0]

    def is_empty(self) -> bool:
        return len(self._heap) == 0

    def _bubble_up(self, i: int) -> None:
        while i > 0:
            parent = (i - 1) // 2
            if self._heap[parent].priority < self._heap[i].priority:
                self._swap(parent, i)
                i = parent
            else:
                break

    def _heapify_down(self, i: int) -> None:
        n = len(self._heap)
        while True:
            left, right, largest = 2 * i + 1, 2 * i + 2, i
            if left < n and self._heap[left].priority > self._heap[largest].priority:
                largest = left
            if right < n and self._heap[right].priority > self._heap[largest].priority:
                largest = right
            if largest == i:
                break
            self._swap(i, largest)
            i = largest

    def _swap(self, a: int, b: int) -> None:
        self._heap[a], self._heap[b] = self._heap[b], self._heap[a]


if __name__ == "__main__":
    queue = TaskMaxHeap()
    queue.insert(TaskManual("E-Mails", 2))
    queue.insert(TaskManual("Backup", 5))
    queue.insert(TaskManual("Server Neustart", 10))
    queue.insert(TaskManual("Monitoring", 3))

    print("Tasks werden verarbeitet:")
    while not queue.is_empty():
        print(queue.extract_max())
