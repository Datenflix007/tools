#include <iostream>
#include <vector>
#include <string>
#include <stdexcept>

struct Task {
    std::string name;
    int priority;
    std::string toString() const {
        return "[" + std::to_string(priority) + "] " + name;
    }
};

class TaskMaxHeap {
    std::vector<Task> heap;

    static int parent(int i) { return (i - 1) / 2; }
    static int left(int i)   { return 2 * i + 1; }
    static int right(int i)  { return 2 * i + 2; }

    void bubbleUp(int i) {
        while (i > 0 && heap[parent(i)].priority < heap[i].priority) {
            std::swap(heap[parent(i)], heap[i]);
            i = parent(i);
        }
    }

    void heapifyDown(int i) {
        int n = static_cast<int>(heap.size());
        while (true) {
            int l = left(i), r = right(i), largest = i;
            if (l < n && heap[l].priority > heap[largest].priority) largest = l;
            if (r < n && heap[r].priority > heap[largest].priority) largest = r;
            if (largest == i) break;
            std::swap(heap[i], heap[largest]);
            i = largest;
        }
    }

public:
    void insert(const std::string& name, int priority) {
        heap.push_back({name, priority});
        bubbleUp(static_cast<int>(heap.size()) - 1);
    }

    Task extractMax() {
        if (heap.empty()) throw std::underflow_error("Heap leer");
        Task max = heap[0];
        heap[0] = heap.back();
        heap.pop_back();
        if (!heap.empty()) heapifyDown(0);
        return max;
    }

    const Task& peek() const {
        if (heap.empty()) throw std::underflow_error("Heap leer");
        return heap[0];
    }

    bool empty() const { return heap.empty(); }
};

int main() {
    TaskMaxHeap q;
    q.insert("E-Mails", 2);
    q.insert("Backup", 5);
    q.insert("Server Neustart", 10);
    q.insert("Monitoring", 3);

    std::cout << "Tasks werden verarbeitet:\n";
    while (!q.empty())
        std::cout << q.extractMax().toString() << "\n";
}
