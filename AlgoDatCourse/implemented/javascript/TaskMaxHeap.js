// JavaScript hat keine eingebaute PriorityQueue – manuelle MaxHeap-Implementierung.

class TaskMaxHeap {
    #heap = [];

    insert(name, priority) {
        this.#heap.push({ name, priority });
        this.#bubbleUp(this.#heap.length - 1);
    }

    extractMax() {
        if (this.isEmpty()) throw new Error('Heap leer');
        this.#swap(0, this.#heap.length - 1);
        const max = this.#heap.pop();
        this.#heapifyDown(0);
        return max;
    }

    peek()    { return this.#heap[0]; }
    isEmpty() { return this.#heap.length === 0; }

    #bubbleUp(i) {
        while (i > 0) {
            const p = Math.floor((i - 1) / 2);
            if (this.#heap[p].priority < this.#heap[i].priority) {
                this.#swap(p, i);
                i = p;
            } else {
                break;
            }
        }
    }

    #heapifyDown(i) {
        const n = this.#heap.length;
        while (true) {
            let l = 2 * i + 1, r = 2 * i + 2, largest = i;
            if (l < n && this.#heap[l].priority > this.#heap[largest].priority) largest = l;
            if (r < n && this.#heap[r].priority > this.#heap[largest].priority) largest = r;
            if (largest === i) break;
            this.#swap(i, largest);
            i = largest;
        }
    }

    #swap(a, b) {
        [this.#heap[a], this.#heap[b]] = [this.#heap[b], this.#heap[a]];
    }
}

const queue = new TaskMaxHeap();
queue.insert('E-Mails', 2);
queue.insert('Backup', 5);
queue.insert('Server Neustart', 10);
queue.insert('Monitoring', 3);

console.log('Tasks werden verarbeitet:');
while (!queue.isEmpty()) {
    const { priority, name } = queue.extractMax();
    console.log(`[${priority}] ${name}`);
}
