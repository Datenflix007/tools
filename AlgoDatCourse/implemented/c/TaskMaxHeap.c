#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define INITIAL_CAPACITY 16

typedef struct {
    char name[128];
    int  priority;
} Task;

typedef struct {
    Task *data;
    int   size;
    int   capacity;
} MaxHeap;

static void swap(Task *a, Task *b) { Task t = *a; *a = *b; *b = t; }
static int  parent(int i) { return (i - 1) / 2; }
static int  left(int i)   { return 2 * i + 1; }
static int  right(int i)  { return 2 * i + 2; }

MaxHeap *heap_create(void) {
    MaxHeap *h  = malloc(sizeof(MaxHeap));
    h->data     = malloc(INITIAL_CAPACITY * sizeof(Task));
    h->size     = 0;
    h->capacity = INITIAL_CAPACITY;
    return h;
}

void heap_insert(MaxHeap *h, const char *name, int priority) {
    if (h->size == h->capacity) {
        h->capacity *= 2;
        h->data = realloc(h->data, h->capacity * sizeof(Task));
    }
    Task t;
    strncpy(t.name, name, sizeof(t.name) - 1);
    t.name[sizeof(t.name) - 1] = '\0';
    t.priority = priority;
    h->data[h->size] = t;
    int i = h->size++;
    while (i > 0 && h->data[parent(i)].priority < h->data[i].priority) {
        swap(&h->data[parent(i)], &h->data[i]);
        i = parent(i);
    }
}

Task heap_extract_max(MaxHeap *h) {
    Task max = h->data[0];
    h->data[0] = h->data[--h->size];
    int i = 0;
    for (;;) {
        int l = left(i), r = right(i), largest = i;
        if (l < h->size && h->data[l].priority > h->data[largest].priority) largest = l;
        if (r < h->size && h->data[r].priority > h->data[largest].priority) largest = r;
        if (largest == i) break;
        swap(&h->data[i], &h->data[largest]);
        i = largest;
    }
    return max;
}

void heap_free(MaxHeap *h) { free(h->data); free(h); }

int main(void) {
    MaxHeap *q = heap_create();
    heap_insert(q, "E-Mails", 2);
    heap_insert(q, "Backup", 5);
    heap_insert(q, "Server Neustart", 10);
    heap_insert(q, "Monitoring", 3);

    printf("Tasks werden verarbeitet:\n");
    while (q->size > 0) {
        Task t = heap_extract_max(q);
        printf("[%d] %s\n", t.priority, t.name);
    }
    heap_free(q);
    return 0;
}
