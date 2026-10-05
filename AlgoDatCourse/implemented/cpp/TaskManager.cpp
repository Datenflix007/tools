#include <iostream>
#include <queue>
#include <string>

struct Task {
    std::string name;
    int priority;

    // operator< definiert die Ordnung für std::priority_queue (Max-Heap)
    bool operator<(const Task& o) const { return priority < o.priority; }

    std::string toString() const {
        return "[" + std::to_string(priority) + "] " + name;
    }
};

int main() {
    // std::priority_queue ist standardmäßig ein MaxHeap (größtes Element oben)
    std::priority_queue<Task> pq;

    pq.push({"E-Mails beantworten", 2});
    pq.push({"Server neu starten", 10});
    pq.push({"Hauspost wegbringen", 7});
    pq.push({"Essensmarken besorgen", 1});
    pq.push({"Backup durchführen", 5});

    std::cout << "Nächste Aufgabe: " << pq.top().toString() << "\n\n";
    std::cout << "Tasks werden verarbeitet:\n";
    while (!pq.empty()) {
        std::cout << "Bearbeite: " << pq.top().toString() << "\n";
        pq.pop();
    }
}
