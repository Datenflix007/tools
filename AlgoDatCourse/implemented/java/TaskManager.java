import java.util.Comparator;
import java.util.PriorityQueue;

class TaskManager {

    private PriorityQueue<Task> heap;

    public TaskManager() {

        // Höhere Priorität zuerst
        heap = new PriorityQueue<>(
            Comparator.comparingInt((Task t) -> t.priority).reversed()
        );
    }

    // Aufgabe hinzufügen
    public void addTask(String name, int priority) {
        heap.add(new Task(name, priority));
    }

    // Wichtigste Aufgabe holen und entfernen
    public Task getNextTask() {
        return heap.poll();
    }

    // Wichtigste Aufgabe ansehen
    public Task peekTask() {
        return heap.peek();
    }

    // Prüfen ob leer
    public boolean isEmpty() {
        return heap.isEmpty();
    }
    
    public static void main(String[] args) {

        TaskManager manager = new TaskManager();

        manager.addTask("E-Mails beantworten", 2);
        manager.addTask("Server neu starten", 10);
        manager.addTask("Hauspost wegbringen", 7);
        manager.addTask("Essensmarken besorgen", 1);
        manager.addTask("Backup durchführen", 5);

        System.out.println("Nächste Aufgabe:");
        System.out.println(manager.peekTask());

        System.out.println();

        while (!manager.isEmpty()) {
            Task t = manager.getNextTask();
            System.out.println("Bearbeite: " + t);
        }
    }
}