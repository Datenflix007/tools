import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

class RBTree<K extends Comparable<K>, V> {
    private static final boolean RED = true;
    private static final boolean BLACK = false;

    private final Node nil = new Node(null, null, BLACK);
    private Node root = nil;

    private class Node {
        K key;
        V value;
        boolean color;
        Node left = nil;
        Node right = nil;
        Node parent = nil;
        int size = 1;  // Größe des Subtree

        Node(K key, V value, boolean color) {
            this.key = key;
            this.value = value;
            this.color = color;
        }
    }

    public RBTree() {
        nil.left = nil.right = nil.parent = nil;
    }

    public RBTree(List<K> keys, List<V> values) {
        this();
        for (int i = 0; i < keys.size(); i++) {
            insert(keys.get(i), values.get(i));
        }
    }

    public V search(K key) {
        Node node = searchNode(key);
        return node == nil ? null : node.value;
    }

    private Node searchNode(K key) {
        Node x = root;
        while (x != nil && key.compareTo(x.key) != 0) {
            x = key.compareTo(x.key) < 0 ? x.left : x.right;
        }
        return x;
    }

    public K minimum() {
        Node node = minimum(root);
        return node == nil ? null : node.key;
    }

    public K maximum() {
        Node node = maximum(root);
        return node == nil ? null : node.key;
    }

    private Node minimum(Node x) {
        while (x != nil && x.left != nil) {
            x = x.left;
        }
        return x;
    }

    private Node maximum(Node x) {
        while (x != nil && x.right != nil) {
            x = x.right;
        }
        return x;
    }

    public K successor(K key) {
        Node node = searchNode(key);
        if (node == nil) return null;
        if (node.right != nil) return minimum(node.right).key;
        Node y = node.parent;
        while (y != nil && node == y.right) {
            node = y;
            y = y.parent;
        }
        return y == nil ? null : y.key;
    }

    public K predecessor(K key) {
        Node node = searchNode(key);
        if (node == nil) return null;
        if (node.left != nil) return maximum(node.left).key;
        Node y = node.parent;
        while (y != nil && node == y.left) {
            node = y;
            y = y.parent;
        }
        return y == nil ? null : y.key;
    }

    public void insert(K key, V value) {
        Node z = new Node(key, value, RED);
        Node y = nil;
        Node x = root;
        while (x != nil) {
            y = x;
            int cmp = z.key.compareTo(x.key);
            if (cmp < 0) {
                x = x.left;
            } else if (cmp > 0) {
                x = x.right;
            } else {
                x.value = value;
                return;
            }
        }
        z.parent = y;
        if (y == nil) {
            root = z;
        } else if (z.key.compareTo(y.key) < 0) {
            y.left = z;
        } else {
            y.right = z;
        }
        z.left = nil;
        z.right = nil;
        
        // Größen aktualisieren
        Node temp = y;
        while (temp != nil) {
            updateSize(temp);
            temp = temp.parent;
        }
        
        insertFixup(z);
    }

    private void insertFixup(Node z) {
        while (z.parent.color == RED) {
            if (z.parent == z.parent.parent.left) {
                Node y = z.parent.parent.right;
                if (y.color == RED) {
                    z.parent.color = BLACK;
                    y.color = BLACK;
                    z.parent.parent.color = RED;
                    z = z.parent.parent;
                } else {
                    if (z == z.parent.right) {
                        z = z.parent;
                        leftRotate(z);
                    }
                    z.parent.color = BLACK;
                    z.parent.parent.color = RED;
                    rightRotate(z.parent.parent);
                }
            } else {
                Node y = z.parent.parent.left;
                if (y.color == RED) {
                    z.parent.color = BLACK;
                    y.color = BLACK;
                    z.parent.parent.color = RED;
                    z = z.parent.parent;
                } else {
                    if (z == z.parent.left) {
                        z = z.parent;
                        rightRotate(z);
                    }
                    z.parent.color = BLACK;
                    z.parent.parent.color = RED;
                    leftRotate(z.parent.parent);
                }
            }
        }
        root.color = BLACK;
    }

    private void leftRotate(Node x) {
        Node y = x.right;
        x.right = y.left;
        if (y.left != nil) y.left.parent = x;
        y.parent = x.parent;
        if (x.parent == nil) root = y;
        else if (x == x.parent.left) x.parent.left = y;
        else x.parent.right = y;
        y.left = x;
        x.parent = y;
        
        // Größen aktualisieren
        updateSize(x);
        updateSize(y);
    }

    private void rightRotate(Node y) {
        Node x = y.left;
        y.left = x.right;
        if (x.right != nil) x.right.parent = y;
        x.parent = y.parent;
        if (y.parent == nil) root = x;
        else if (y == y.parent.right) y.parent.right = x;
        else y.parent.left = x;
        x.right = y;
        y.parent = x;
        
        // Größen aktualisieren
        updateSize(y);
        updateSize(x);
    }

    public boolean delete(K key) {
        Node z = searchNode(key);
        if (z == nil) return false;
        Node y = z;
        boolean yOriginalColor = y.color;
        Node x;
        if (z.left == nil) {
            x = z.right;
            transplant(z, z.right);
        } else if (z.right == nil) {
            x = z.left;
            transplant(z, z.left);
        } else {
            y = minimum(z.right);
            yOriginalColor = y.color;
            x = y.right;
            if (y.parent == z) {
                x.parent = y;
            } else {
                transplant(y, y.right);
                y.right = z.right;
                y.right.parent = y;
            }
            transplant(z, y);
            y.left = z.left;
            y.left.parent = y;
            y.color = z.color;
        }
        if (yOriginalColor == BLACK) deleteFixup(x);
        return true;
    }

    private void transplant(Node u, Node v) {
        if (u.parent == nil) root = v;
        else if (u == u.parent.left) u.parent.left = v;
        else u.parent.right = v;
        v.parent = u.parent;
    }

    private void deleteFixup(Node x) {
        while (x != root && x.color == BLACK) {
            if (x == x.parent.left) {
                Node w = x.parent.right;
                if (w.color == RED) {
                    w.color = BLACK;
                    x.parent.color = RED;
                    leftRotate(x.parent);
                    w = x.parent.right;
                }
                if (w.left.color == BLACK && w.right.color == BLACK) {
                    w.color = RED;
                    x = x.parent;
                } else {
                    if (w.right.color == BLACK) {
                        w.left.color = BLACK;
                        w.color = RED;
                        rightRotate(w);
                        w = x.parent.right;
                    }
                    w.color = x.parent.color;
                    x.parent.color = BLACK;
                    w.right.color = BLACK;
                    leftRotate(x.parent);
                    x = root;
                }
            } else {
                Node w = x.parent.left;
                if (w.color == RED) {
                    w.color = BLACK;
                    x.parent.color = RED;
                    rightRotate(x.parent);
                    w = x.parent.left;
                }
                if (w.right.color == BLACK && w.left.color == BLACK) {
                    w.color = RED;
                    x = x.parent;
                } else {
                    if (w.left.color == BLACK) {
                        w.right.color = BLACK;
                        w.color = RED;
                        leftRotate(w);
                        w = x.parent.left;
                    }
                    w.color = x.parent.color;
                    x.parent.color = BLACK;
                    w.left.color = BLACK;
                    rightRotate(x.parent);
                    x = root;
                }
            }
        }
        x.color = BLACK;
    }

    public List<K> inorderKeys() {
        List<K> keys = new ArrayList<>();
        inorder(root, keys);
        return keys;
    }

    private void inorder(Node node, List<K> keys) {
        if (node == nil) return;
        inorder(node.left, keys);
        keys.add(node.key);
        inorder(node.right, keys);
    }

    // Hilfsmethode zur Größenaktualisierung
    private void updateSize(Node node) {
        if (node != nil) {
            node.size = 1 + (node.left != nil ? node.left.size : 0) + (node.right != nil ? node.right.size : 0);
        }
    }

    // Gibt an, ob der Knoten mit key rot ist
    public boolean isNodeRed(K key) {
        Node node = searchNode(key);
        return node != nil && node.color == RED;
    }

    // Hilfsmethoden für UI-Rendering
    public K getRoot() {
        return root == nil ? null : root.key;
    }

    public K getLeftChild(K key) {
        Node node = searchNode(key);
        return node != nil && node.left != nil ? node.left.key : null;
    }

    public K getRightChild(K key) {
        Node node = searchNode(key);
        return node != nil && node.right != nil ? node.right.key : null;
    }

    // Zählt alle Knoten mit key > x in O(log n)
    public int greaterThan(K x) {
        return greaterThan(root, x);
    }

    private int greaterThan(Node node, K x) {
        if (node == nil) return 0;
        
        int cmp = node.key.compareTo(x);
        
        if (cmp > 0) {
            // node.key > x: Zähle diesen Knoten + rechten Subtree + greaterThan(linker)
            int rightSize = node.right != nil ? node.right.size : 0;
            return 1 + rightSize + greaterThan(node.left, x);
        } else {
            // node.key <= x: Gehe nur nach rechts
            return greaterThan(node.right, x);
        }
    }

    // Zählt alle Knoten mit key < x in O(log n)
    public int lessThan(K x) {
        return lessThan(root, x);
    }

    private int lessThan(Node node, K x) {
        if (node == nil) return 0;
        
        int cmp = node.key.compareTo(x);
        
        if (cmp < 0) {
            // node.key < x: Zähle diesen Knoten + linken Subtree + lessThan(rechter)
            int leftSize = node.left != nil ? node.left.size : 0;
            return 1 + leftSize + lessThan(node.right, x);
        } else {
            // node.key >= x: Gehe nur nach links
            return lessThan(node.left, x);
        }
    }

    // Gibt eine Liste aller Knoten zurück, die größer als x sind
    public List<K> getGreaterThan(K x) {
        List<K> result = new ArrayList<>();
        collectGreaterThan(root, x, result);
        return result;
    }

    private void collectGreaterThan(Node node, K x, List<K> result) {
        if (node == nil) return;
        
        if (node.key.compareTo(x) > 0) {
            collectGreaterThan(node.left, x, result);
            result.add(node.key);
            collectGreaterThan(node.right, x, result);
        } else {
            collectGreaterThan(node.right, x, result);
        }
    }

    // Gibt eine Liste aller Knoten zurück, die kleiner als x sind
    public List<K> getLessThan(K x) {
        List<K> result = new ArrayList<>();
        collectLessThan(root, x, result);
        return result;
    }

    private void collectLessThan(Node node, K x, List<K> result) {
        if (node == nil) return;
        
        if (node.key.compareTo(x) < 0) {
            collectLessThan(node.left, x, result);
            result.add(node.key);
            collectLessThan(node.right, x, result);
        } else {
            collectLessThan(node.left, x, result);
        }
    }

    // JSON Serialisierung
    public String toJSON() {
        StringBuilder sb = new StringBuilder();
        sb.append("[");
        List<K> keys = inorderKeys();
        for (int i = 0; i < keys.size(); i++) {
            if (i > 0) sb.append(",");
            V val = search(keys.get(i));
            String valStr = val != null ? jsonEscape(val.toString()) : "";
            sb.append("{\"k\":").append(keys.get(i))
              .append(",\"v\":\"").append(valStr).append("\"}");
        }
        sb.append("]");
        return sb.toString();
    }

    private static String jsonEscape(String s) {
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    // JSON Deserialisierung
    public static RBTree<Integer, String> fromJSON(String json) {
        RBTree<Integer, String> tree = new RBTree<>();
        json = json.trim();
        if (!json.startsWith("[") || !json.endsWith("]")) return tree;

        String content = json.substring(1, json.length() - 1).trim();
        if (content.isEmpty()) return tree;

        if (content.startsWith("{")) {
            // New format: [{"k":15,"v":"some value"},...]
            Pattern p = Pattern.compile("\\{\"k\":(\\d+),\"v\":\"((?:[^\"\\\\]|\\\\.)*)\"\\}");
            Matcher m = p.matcher(content);
            while (m.find()) {
                try {
                    int key = Integer.parseInt(m.group(1));
                    String value = m.group(2)
                        .replace("\\\"", "\"").replace("\\\\", "\\")
                        .replace("\\n", "\n").replace("\\r", "\r");
                    tree.insert(key, value);
                } catch (NumberFormatException e) { /* skip */ }
            }
        } else {
            // Legacy format: [1,2,3,...]
            for (String val : content.split(",")) {
                try {
                    int key = Integer.valueOf(val.trim());
                    tree.insert(key, "Value_" + key);
                } catch (NumberFormatException e) { /* skip */ }
            }
        }

        return tree;
    }

    
}
