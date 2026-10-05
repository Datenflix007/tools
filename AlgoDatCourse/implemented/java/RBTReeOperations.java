import javax.swing.*;
import javax.swing.filechooser.FileNameExtensionFilter;
import java.awt.*;
import java.awt.event.*;
import java.io.*;
import java.util.*;
import java.util.List;

public class RBTReeOperations {
    
    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> {
            JFrame frame = new JFrame("RB-Tree Visualizer");
            frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
            frame.setSize(1600, 950);
            frame.setLocationRelativeTo(null);
            frame.setResizable(true);
            
            RBTree<Integer, String> tree = new RBTree<>();
            int[] values = {15, 10, 20, 8, 12, 17, 25, 5, 11, 14, 16, 22, 27};
            for (int val : values) {
                tree.insert(val, "Value_" + val);
            }
            
            RBTreePanel panel = new RBTreePanel(tree);
            frame.setJMenuBar(createMenuBar(panel));
            frame.add(panel);
            frame.setVisible(true);
        });
    }
    
    private static JMenuBar createMenuBar(RBTreePanel panel) {
        JMenuBar menuBar = new JMenuBar();
        
        JMenu fileMenu = new JMenu("FILE");
        fileMenu.add(createMenuItem("✚ Neuer Baum", () -> panel.handleNewTree()));
        fileMenu.add(createMenuItem("💾 Speichern", () -> panel.handleSave()));
        fileMenu.add(createMenuItem("📂 Laden", () -> panel.handleLoad()));
        fileMenu.addSeparator();
        fileMenu.add(createMenuItem("Exit", () -> System.exit(0)));
        
        JMenu dictMenu = new JMenu("DICTIONARY");
        dictMenu.add(createMenuItem("➕ Insert", () -> panel.handleInsert()));
        dictMenu.add(createMenuItem("❌ Delete", () -> panel.handleDelete()));
        dictMenu.add(createMenuItem("🔍 Search", () -> panel.handleSearch()));
        dictMenu.addSeparator();
        dictMenu.add(createMenuItem("⬇ Min", () -> panel.handleMin()));
        dictMenu.add(createMenuItem("⬆ Max", () -> panel.handleMax()));
        dictMenu.add(createMenuItem("➡ Successor", () -> panel.handleSuccessor()));
        dictMenu.add(createMenuItem("⬅ Predecessor", () -> panel.handlePredecessor()));
        dictMenu.addSeparator();
        dictMenu.add(createMenuItem("🟨 greaterThan", () -> panel.showCountDialog(true)));
        dictMenu.add(createMenuItem("🟨 lessThan", () -> panel.showCountDialog(false)));
        
        menuBar.add(fileMenu);
        menuBar.add(dictMenu);
        
        return menuBar;
    }
    
    private static JMenuItem createMenuItem(String text, Runnable action) {
        JMenuItem item = new JMenuItem(text);
        item.addActionListener(e -> action.run());
        return item;
    }
}

class RBTreePanel extends JPanel {
    private RBTree<Integer, String> tree;
    private TreeCanvasPanel canvasPanel;
    private JTextField inputField;
    private JLabel resultLabel;
    
    public RBTreePanel(RBTree<Integer, String> tree) {
        this.tree = tree;
        setLayout(new BorderLayout());
        setBackground(new Color(245, 247, 250));
        
        canvasPanel = new TreeCanvasPanel(tree);
        add(canvasPanel, BorderLayout.CENTER);
        
        JPanel statusPanel = new JPanel();
        statusPanel.setBackground(new Color(235, 240, 245));
        statusPanel.setBorder(BorderFactory.createLineBorder(new Color(200, 210, 220)));
        
        resultLabel = new JLabel("Bereit");
        resultLabel.setFont(new Font("Segoe UI", Font.BOLD, 12));
        resultLabel.setForeground(new Color(40, 120, 200));
        resultLabel.setBorder(BorderFactory.createEmptyBorder(5, 10, 5, 10));
        statusPanel.add(resultLabel);
        
        add(statusPanel, BorderLayout.SOUTH);
    }
    
    public void handleInsert() {
        String keyStr = JOptionPane.showInputDialog(this, "Key eingeben:", "");
        if (keyStr == null) return;

        try {
            int key = Integer.parseInt(keyStr);

            JPanel panel = new JPanel(new BorderLayout(5, 5));
            JLabel label = new JLabel("Value (Text, URL oder Dateipfad):");
            JTextField valueField = new JTextField("Value_" + key, 22);
            JButton browseBtn = new JButton("📁");
            browseBtn.setToolTipText("Datei auswählen");
            browseBtn.addActionListener(e -> {
                JFileChooser fc = new JFileChooser();
                fc.setDialogTitle("Datei auswählen");
                if (fc.showOpenDialog(RBTreePanel.this) == JFileChooser.APPROVE_OPTION) {
                    valueField.setText(fc.getSelectedFile().getAbsolutePath());
                }
            });
            JPanel inputRow = new JPanel(new BorderLayout(4, 0));
            inputRow.add(valueField, BorderLayout.CENTER);
            inputRow.add(browseBtn, BorderLayout.EAST);
            panel.add(label, BorderLayout.NORTH);
            panel.add(inputRow, BorderLayout.CENTER);

            int result = JOptionPane.showConfirmDialog(this, panel,
                "Insert – Key " + key, JOptionPane.OK_CANCEL_OPTION, JOptionPane.PLAIN_MESSAGE);
            if (result != JOptionPane.OK_OPTION) return;

            String value = valueField.getText().trim();
            if (value.isEmpty()) value = "Value_" + key;

            tree.insert(key, value);
            canvasPanel.clearHighlight();
            canvasPanel.repaint();
            String display = value.length() > 40 ? value.substring(0, 40) + "…" : value;
            resultLabel.setText("✓ " + key + " → " + display);
        } catch (NumberFormatException ex) {
            resultLabel.setText("✗ Ungültige Key-Eingabe");
        }
    }
    
    public void handleDelete() {
        String keyStr = JOptionPane.showInputDialog(this, "Key eingeben:", "");
        if (keyStr == null) return;
        
        try {
            int key = Integer.parseInt(keyStr);
            boolean deleted = tree.delete(key);
            canvasPanel.clearHighlight();
            canvasPanel.repaint();
            resultLabel.setText(deleted ? "✓ " + key + " gelöscht" : "✗ " + key + " nicht gefunden");
        } catch (NumberFormatException ex) {
            resultLabel.setText("✗ Ungültige Eingabe");
        }
    }
    
    public void handleSearch() {
        String keyStr = JOptionPane.showInputDialog(this, "Key eingeben:", "");
        if (keyStr == null) return;
        
        try {
            int key = Integer.parseInt(keyStr);
            String result = tree.search(key);
            canvasPanel.clearHighlight();
            canvasPanel.highlightNodes(Arrays.asList(key));
            canvasPanel.repaint();
            resultLabel.setText(result != null ? "✓ Gefunden: " + result : "✗ Nicht gefunden");
        } catch (NumberFormatException ex) {
            resultLabel.setText("✗ Ungültige Eingabe");
        }
    }
    
    public void handleMin() {
        Integer min = tree.minimum();
        canvasPanel.clearHighlight();
        if (min != null) {
            canvasPanel.highlightNodes(Arrays.asList(min));
            canvasPanel.repaint();
            resultLabel.setText("Minimum: " + min);
        } else {
            resultLabel.setText("Baum ist leer");
        }
    }
    
    public void handleMax() {
        Integer max = tree.maximum();
        canvasPanel.clearHighlight();
        if (max != null) {
            canvasPanel.highlightNodes(Arrays.asList(max));
            canvasPanel.repaint();
            resultLabel.setText("Maximum: " + max);
        } else {
            resultLabel.setText("Baum ist leer");
        }
    }
    
    public void handleSuccessor() {
        String keyStr = JOptionPane.showInputDialog(this, "Key eingeben:", "");
        if (keyStr == null) return;
        
        try {
            int key = Integer.parseInt(keyStr);
            Integer succ = tree.successor(key);
            canvasPanel.clearHighlight();
            if (succ != null) {
                canvasPanel.highlightNodes(Arrays.asList(succ));
                canvasPanel.repaint();
                resultLabel.setText("Successor von " + key + ": " + succ);
            } else {
                resultLabel.setText("Kein Successor");
            }
        } catch (NumberFormatException ex) {
            resultLabel.setText("✗ Ungültige Eingabe");
        }
    }
    
    public void handlePredecessor() {
        String keyStr = JOptionPane.showInputDialog(this, "Key eingeben:", "");
        if (keyStr == null) return;
        
        try {
            int key = Integer.parseInt(keyStr);
            Integer pred = tree.predecessor(key);
            canvasPanel.clearHighlight();
            if (pred != null) {
                canvasPanel.highlightNodes(Arrays.asList(pred));
                canvasPanel.repaint();
                resultLabel.setText("Predecessor von " + key + ": " + pred);
            } else {
                resultLabel.setText("Kein Predecessor");
            }
        } catch (NumberFormatException ex) {
            resultLabel.setText("✗ Ungültige Eingabe");
        }
    }
    
    public void showCountDialog(boolean isGreater) {
        String xStr = JOptionPane.showInputDialog(this, "Wert eingeben:", "");
        if (xStr == null) return;
        
        try {
            int x = Integer.parseInt(xStr);
            if (isGreater) {
                int count = tree.greaterThan(x);
                List<Integer> nodes = tree.getGreaterThan(x);
                canvasPanel.clearHighlight();
                canvasPanel.highlightNodes(nodes);
                canvasPanel.repaint();
                resultLabel.setText("<html><font size='5' color='#d06000'><b>" + count + "</b></font>&nbsp;Knoten greaterThan(<b>" + x + "</b>)</html>");
            } else {
                int count = tree.lessThan(x);
                List<Integer> nodes = tree.getLessThan(x);
                canvasPanel.clearHighlight();
                canvasPanel.highlightNodes(nodes);
                canvasPanel.repaint();
                resultLabel.setText("<html><font size='5' color='#d06000'><b>" + count + "</b></font>&nbsp;Knoten lessThan(<b>" + x + "</b>)</html>");
            }
        } catch (NumberFormatException ex) {
            resultLabel.setText("✗ Ungültige Eingabe");
        }
    }
    
    public void handleNewTree() {
        tree = new RBTree<>();
        canvasPanel.setTree(tree);
        canvasPanel.clearHighlight();
        canvasPanel.repaint();
        resultLabel.setText("✓ Neuer leerer Baum erstellt");
    }
    
    public void handleSave() {
        JFileChooser fileChooser = new JFileChooser();
        fileChooser.setFileFilter(new FileNameExtensionFilter("JSON Files", "json"));
        int result = fileChooser.showSaveDialog(this);
        if (result == JFileChooser.APPROVE_OPTION) {
            try {
                File file = fileChooser.getSelectedFile();
                String jsonContent = tree.toJSON();
                FileWriter writer = new FileWriter(file);
                writer.write(jsonContent);
                writer.close();
                resultLabel.setText("✓ Gespeichert: " + file.getName());
            } catch (IOException ex) {
                resultLabel.setText("✗ Fehler beim Speichern");
            }
        }
    }
    
    public void handleLoad() {
        JFileChooser fileChooser = new JFileChooser();
        fileChooser.setFileFilter(new FileNameExtensionFilter("JSON Files", "json"));
        int result = fileChooser.showOpenDialog(this);
        if (result == JFileChooser.APPROVE_OPTION) {
            try {
                File file = fileChooser.getSelectedFile();
                StringBuilder content = new StringBuilder();
                Scanner scanner = new Scanner(file);
                while (scanner.hasNextLine()) {
                    content.append(scanner.nextLine());
                }
                scanner.close();
                
                tree = RBTree.fromJSON(content.toString());
                canvasPanel.setTree(tree);
                canvasPanel.clearHighlight();
                canvasPanel.repaint();
                resultLabel.setText("✓ Geladen: " + file.getName());
            } catch (Exception ex) {
                resultLabel.setText("✗ Fehler beim Laden");
            }
        }
    }
}

class TreeCanvasPanel extends JPanel {
    private RBTree<Integer, String> tree;
    private Set<Integer> highlightedNodes;
    private static final int NODE_RADIUS = 30;
    private static final int LEVEL_HEIGHT = 100;
    private javax.swing.Timer animationTimer;
    // physics state per node: [offsetX, offsetY, velX, velY]
    private final Map<Integer, double[]> wobbleState = new HashMap<>();
    private final List<int[]> nilPositions = new ArrayList<>(); // {nilX, nilY, parentKey}
    private Integer draggingKey = null;
    private boolean wasDragged = false;
    private int dragStartMouseX, dragStartMouseY;
    private double dragInitOffX, dragInitOffY;

    public TreeCanvasPanel(RBTree<Integer, String> tree) {
        this.tree = tree;
        this.highlightedNodes = new HashSet<>();
        setBackground(new Color(245, 247, 250));
        setToolTipText("");

        addMouseListener(new MouseAdapter() {
            @Override
            public void mousePressed(MouseEvent e) {
                if (e.getButton() == MouseEvent.BUTTON1) {
                    Integer key = getNodeAtPoint(e.getX(), e.getY());
                    if (key != null) {
                        draggingKey = key;
                        wasDragged = false;
                        double[] s = wobbleState.computeIfAbsent(key, k -> new double[4]);
                        dragStartMouseX = e.getX();
                        dragStartMouseY = e.getY();
                        dragInitOffX = s[0];
                        dragInitOffY = s[1];
                        s[2] = 0; s[3] = 0;
                    }
                }
            }
            @Override
            public void mouseReleased(MouseEvent e) {
                if (draggingKey != null) {
                    if (wasDragged) {
                        double[] s = wobbleState.get(draggingKey);
                        if (s != null) {
                            s[2] = s[0] * 0.06;
                            s[3] = s[1] * 0.06;
                        }
                    } else {
                        wobbleState.remove(draggingKey);
                        final Integer clickedKey = draggingKey;
                        SwingUtilities.invokeLater(() -> showValueEditor(clickedKey));
                    }
                    draggingKey = null;
                }
            }
        });

        addMouseMotionListener(new MouseMotionAdapter() {
            @Override
            public void mouseDragged(MouseEvent e) {
                if (draggingKey != null) {
                    int dx = e.getX() - dragStartMouseX;
                    int dy = e.getY() - dragStartMouseY;
                    if (!wasDragged && dx * dx + dy * dy > 25) wasDragged = true;
                    if (wasDragged) {
                        double[] s = wobbleState.computeIfAbsent(draggingKey, k -> new double[4]);
                        s[0] = dragInitOffX + dx;
                        s[1] = dragInitOffY + dy;
                    }
                }
            }
        });

        startAnimation();
    }

    private void startAnimation() {
        animationTimer = new javax.swing.Timer(20, e -> {
            stepPhysics();
            repaint();
        });
        animationTimer.start();
    }

    private void stepPhysics() {
        wobbleState.entrySet().removeIf(entry -> {
            if (draggingKey != null && draggingKey.equals(entry.getKey())) return false;
            double[] s = entry.getValue();
            s[2] = s[2] * 0.88 - s[0] * 0.10;
            s[3] = s[3] * 0.88 - s[1] * 0.10;
            s[0] += s[2];
            s[1] += s[3];
            return Math.abs(s[0]) < 0.08 && Math.abs(s[1]) < 0.08
                && Math.abs(s[2]) < 0.08 && Math.abs(s[3]) < 0.08;
        });
    }

    private Integer getNodeAtPoint(int mx, int my) {
        Map<Integer, NodePosition> positions = calculateTreePositions();
        for (NodePosition np : positions.values()) {
            int nx = (int)(np.x + getWobbleX(np.value));
            int ny = (int)(np.y + getWobbleY(np.value));
            int dx = mx - nx, dy = my - ny;
            if (dx * dx + dy * dy <= NODE_RADIUS * NODE_RADIUS) return np.value;
        }
        return null;
    }

    public void setTree(RBTree<Integer, String> newTree) {
        this.tree = newTree;
        wobbleState.clear();
    }
    
    public void highlightNodes(List<Integer> nodes) {
        highlightedNodes.addAll(nodes);
    }
    
    public void clearHighlight() {
        highlightedNodes.clear();
    }
    
    @Override
    protected void paintComponent(Graphics g) {
        super.paintComponent(g);
        Graphics2D g2d = (Graphics2D) g;
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g2d.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        
        List<Integer> keys = tree.inorderKeys();
        if (keys.isEmpty()) {
            g2d.setFont(new Font("Segoe UI", Font.PLAIN, 20));
            g2d.setColor(new Color(150, 150, 150));
            String msg = "Baum ist leer • Gehe zu DICTIONARY > Insert";
            FontMetrics fm = g2d.getFontMetrics();
            int x = (getWidth() - fm.stringWidth(msg)) / 2;
            g2d.drawString(msg, x, getHeight() / 2);
            return;
        }
        
        Map<Integer, NodePosition> positions = calculateTreePositions();
        drawEdges(g2d, positions);
        drawNilNodes(g2d, positions);
        drawNodes(g2d, positions);
    }
    
    private Map<Integer, NodePosition> calculateTreePositions() {
        nilPositions.clear();
        Map<Integer, NodePosition> positions = new HashMap<>();
        if (tree.inorderKeys().isEmpty()) return positions;

        int startX = getWidth() / 2;
        Integer root = tree.getRoot();
        if (root != null) calculatePosition(positions, root, startX, 40, getWidth() / 4);
        return positions;
    }

    private void calculatePosition(Map<Integer, NodePosition> positions, Integer key, int x, int y, int offset) {
        if (key == null) return;

        positions.put(key, new NodePosition(key, x, y, tree.isNodeRed(key), tree.search(key)));

        Integer left = tree.getLeftChild(key);
        Integer right = tree.getRightChild(key);
        int childOff = Math.max(offset / 2, 30);

        if (left != null) {
            calculatePosition(positions, left, x - offset, y + LEVEL_HEIGHT, childOff);
        } else {
            nilPositions.add(new int[]{x - offset, y + LEVEL_HEIGHT, key});
        }
        if (right != null) {
            calculatePosition(positions, right, x + offset, y + LEVEL_HEIGHT, childOff);
        } else {
            nilPositions.add(new int[]{x + offset, y + LEVEL_HEIGHT, key});
        }
    }
    
    private double getWobbleX(int nodeKey) {
        double[] s = wobbleState.get(nodeKey);
        return s != null ? s[0] : 0;
    }

    private double getWobbleY(int nodeKey) {
        double[] s = wobbleState.get(nodeKey);
        return s != null ? s[1] : 0;
    }
    
    private void drawEdges(Graphics2D g2d, Map<Integer, NodePosition> positions) {
        g2d.setColor(new Color(180, 190, 200));
        g2d.setStroke(new BasicStroke(2.5f));
        
        List<Integer> keys = tree.inorderKeys();
        for (Integer key : keys) {
            NodePosition parent = positions.get(key);
            if (parent == null) continue;
            
            Integer left = tree.getLeftChild(key);
            Integer right = tree.getRightChild(key);
            
            int px = (int)(parent.x + getWobbleX(key));
            int py = (int)(parent.y + getWobbleY(key));

            if (left != null && positions.containsKey(left)) {
                NodePosition child = positions.get(left);
                int cx = (int)(child.x + getWobbleX(left));
                int cy = (int)(child.y + getWobbleY(left));
                g2d.drawLine(px, py + NODE_RADIUS, cx, cy - NODE_RADIUS);
            }
            if (right != null && positions.containsKey(right)) {
                NodePosition child = positions.get(right);
                int cx = (int)(child.x + getWobbleX(right));
                int cy = (int)(child.y + getWobbleY(right));
                g2d.drawLine(px, py + NODE_RADIUS, cx, cy - NODE_RADIUS);
            }
        }
    }
    
    private void drawNodes(Graphics2D g2d, Map<Integer, NodePosition> positions) {
        for (NodePosition np : positions.values()) {
            int x = (int)(np.x + getWobbleX(np.value));
            int y = (int)(np.y + getWobbleY(np.value));
            
            if (highlightedNodes.contains(np.value)) {
                g2d.setColor(new Color(255, 255, 0, 80));
                g2d.fillOval(x - NODE_RADIUS - 12, y - NODE_RADIUS - 12, 
                            (NODE_RADIUS + 12) * 2, (NODE_RADIUS + 12) * 2);
            }
            
            g2d.setColor(new Color(0, 0, 0, 30));
            g2d.fillOval(x - NODE_RADIUS + 3, y - NODE_RADIUS + 3, NODE_RADIUS * 2, NODE_RADIUS * 2);
            
            Color color = np.isRed ? new Color(220, 60, 60) : new Color(50, 50, 50);
            g2d.setColor(color);
            g2d.fillOval(x - NODE_RADIUS, y - NODE_RADIUS, NODE_RADIUS * 2, NODE_RADIUS * 2);
            
            g2d.setColor(np.isRed ? new Color(180, 20, 20) : new Color(20, 20, 20));
            g2d.setStroke(new BasicStroke(2.5f));
            g2d.drawOval(x - NODE_RADIUS, y - NODE_RADIUS, NODE_RADIUS * 2, NODE_RADIUS * 2);
            
            g2d.setColor(Color.WHITE);
            g2d.setFont(new Font("Segoe UI", Font.BOLD, 14));
            String text = String.valueOf(np.value);
            FontMetrics fm = g2d.getFontMetrics();
            int textX = x - fm.stringWidth(text) / 2;
            int textY = y + fm.getAscent() / 2 - 2;
            g2d.drawString(text, textX, textY);

            g2d.setColor(np.isRed ? new Color(255, 100, 100) : new Color(150, 150, 150));
            g2d.setFont(new Font("Segoe UI", Font.PLAIN, 9));
            String colorLabel = np.isRed ? "R" : "B";
            FontMetrics fmSmall = g2d.getFontMetrics();
            g2d.drawString(colorLabel, x - fmSmall.stringWidth(colorLabel) / 2, y + NODE_RADIUS + 13);

            if (np.nodeValue != null && !np.nodeValue.isEmpty()) {
                String displayVal = truncateValue(np.nodeValue, 11);
                g2d.setColor(new Color(80, 110, 150));
                g2d.setFont(new Font("Segoe UI", Font.PLAIN, 9));
                FontMetrics fmVal = g2d.getFontMetrics();
                g2d.drawString(displayVal, x - fmVal.stringWidth(displayVal) / 2, y + NODE_RADIUS + 25);
            }
        }
    }

    private void drawNilNodes(Graphics2D g2d, Map<Integer, NodePosition> positions) {
        int nw = 22, nh = 13;
        float[] dash = {4f, 4f};
        Stroke dashed = new BasicStroke(1.2f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND, 0, dash, 0);
        Stroke solid  = new BasicStroke(1f);

        for (int[] nil : nilPositions) {
            int nx = nil[0], ny = nil[1];
            NodePosition parent = positions.get(nil[2]);
            if (parent != null) {
                int px = (int)(parent.x + getWobbleX(parent.value));
                int py = (int)(parent.y + getWobbleY(parent.value));
                g2d.setColor(new Color(170, 185, 200, 90));
                g2d.setStroke(dashed);
                g2d.drawLine(px, py + NODE_RADIUS, nx, ny - nh / 2);
            }
            g2d.setStroke(solid);
            g2d.setColor(new Color(0, 0, 0, 12));
            g2d.fillRoundRect(nx - nw / 2 + 2, ny - nh / 2 + 2, nw, nh, 5, 5);
            g2d.setColor(new Color(110, 110, 110, 70));
            g2d.fillRoundRect(nx - nw / 2, ny - nh / 2, nw, nh, 5, 5);
            g2d.setColor(new Color(85, 85, 85, 130));
            g2d.drawRoundRect(nx - nw / 2, ny - nh / 2, nw, nh, 5, 5);
            g2d.setColor(new Color(165, 165, 165));
            g2d.setFont(new Font("Segoe UI", Font.BOLD, 8));
            FontMetrics fm = g2d.getFontMetrics();
            g2d.drawString("NIL", nx - fm.stringWidth("NIL") / 2, ny + fm.getAscent() / 2 - 1);
        }
        g2d.setStroke(new BasicStroke(2.5f));
    }

    @Override
    public String getToolTipText(MouseEvent event) {
        Map<Integer, NodePosition> positions = calculateTreePositions();
        for (NodePosition np : positions.values()) {
            int nx = (int)(np.x + getWobbleX(np.value));
            int ny = (int)(np.y + getWobbleY(np.value));
            int dx = event.getX() - nx;
            int dy = event.getY() - ny;
            if (Math.sqrt(dx * dx + dy * dy) <= NODE_RADIUS) {
                String val = np.nodeValue;
                if (val != null && !val.isEmpty()) {
                    return "<html><b>Key:</b> " + np.value + "<br><b>Value:</b> "
                        + val.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;") + "</html>";
                }
                return "Key: " + np.value;
            }
        }
        return null;
    }

    private void showValueEditor(Integer key) {
        String current = tree.search(key);

        JPanel panel = new JPanel(new BorderLayout(5, 8));
        JLabel keyLabel = new JLabel("Key: " + key);
        keyLabel.setFont(new Font("Segoe UI", Font.BOLD, 12));
        JLabel valLabel = new JLabel("Value:");
        JTextField valueField = new JTextField(current != null ? current : "", 24);
        JButton browseBtn = new JButton("📁");
        browseBtn.setToolTipText("Datei auswählen");
        browseBtn.addActionListener(ev -> {
            JFileChooser fc = new JFileChooser();
            fc.setDialogTitle("Datei auswählen");
            if (fc.showOpenDialog(TreeCanvasPanel.this) == JFileChooser.APPROVE_OPTION)
                valueField.setText(fc.getSelectedFile().getAbsolutePath());
        });
        JPanel inputRow = new JPanel(new BorderLayout(4, 0));
        inputRow.add(valueField, BorderLayout.CENTER);
        inputRow.add(browseBtn, BorderLayout.EAST);
        panel.add(keyLabel, BorderLayout.NORTH);
        panel.add(valLabel, BorderLayout.WEST);
        panel.add(inputRow, BorderLayout.CENTER);

        int res = JOptionPane.showConfirmDialog(TreeCanvasPanel.this, panel,
            "Value bearbeiten", JOptionPane.OK_CANCEL_OPTION, JOptionPane.PLAIN_MESSAGE);
        if (res == JOptionPane.OK_OPTION) {
            String newVal = valueField.getText().trim();
            if (!newVal.isEmpty()) {
                tree.insert(key, newVal);
                repaint();
            }
        }
    }

    private String truncateValue(String value, int maxLen) {
        if (value == null || value.isEmpty()) return "";
        String display = value;
        if (display.contains("\\") || (display.contains("/") && !display.startsWith("http"))) {
            String[] parts = display.replace('\\', '/').split("/");
            display = parts[parts.length - 1];
        } else if (display.startsWith("http://") || display.startsWith("https://")) {
            display = display.replaceFirst("https?://", "").split("/")[0];
        }
        if (display.length() > maxLen) return display.substring(0, maxLen - 2) + "..";
        return display;
    }

    private static class NodePosition {
        int value, x, y;
        boolean isRed;
        String nodeValue;

        NodePosition(int value, int x, int y, boolean isRed, String nodeValue) {
            this.value = value;
            this.x = x;
            this.y = y;
            this.isRed = isRed;
            this.nodeValue = nodeValue;
        }
    }
}

