import heapq

class Task:
    def __init__(self, name: str, priority: int):
        self.name = name
        self.priority = priority

    def __repr__(self):
        return f"[{self.priority}] {self.name}"


class TaskManager:
    """
    Pythons heapq ist wie Javas PriorityQueue intern ein MinHeap.
    Negierte Priorität simuliert einen MaxHeap (höchste Priorität zuerst).
    """
    def __init__(self):
        self._heap: list[tuple[int, int, Task]] = []
        self._counter = 0  # Tie-breaker bei gleicher Priorität

    def add_task(self, name: str, priority: int) -> None:
        task = Task(name, priority)
        heapq.heappush(self._heap, (-priority, self._counter, task))
        self._counter += 1

    def get_next_task(self) -> Task:
        return heapq.heappop(self._heap)[2]

    def peek_task(self) -> Task:
        return self._heap[0][2]

    def is_empty(self) -> bool:
        return len(self._heap) == 0


if __name__ == "__main__":
    manager = TaskManager()
    manager.add_task("E-Mails beantworten", 2)
    manager.add_task("Server neu starten", 10)
    manager.add_task("Hauspost wegbringen", 7)
    manager.add_task("Essensmarken besorgen", 1)
    manager.add_task("Backup durchführen", 5)

    print("Nächste Aufgabe:", manager.peek_task())
    print()
    while not manager.is_empty():
        print("Bearbeite:", manager.get_next_task())
