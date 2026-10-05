public class TaskManual {
    String name;
    int priority;

    public TaskManual(String name, int priority) {
        this.name = name;
        this.priority = priority;
    }

    @Override
    public String toString() {
        return "[" + priority + "] " + name;
    }

    
}
