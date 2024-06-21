import sys
import json
import matplotlib.pyplot as plt
import numpy as np

def create_radar_chart(scores):
    labels = ['Sentimento']
    num_vars = len(labels)

    angles = np.linspace(0, 2 * np.pi, num_vars, endpoint=False).tolist()
    scores += scores[:1]
    angles += angles[:1]

    fig, ax = plt.subplots(figsize=(6, 6), subplot_kw=dict(polar=True))
    ax.fill(angles, scores, color='blue', alpha=0.25)
    ax.plot(angles, scores, color='blue', linewidth=2)

    ax.set_yticklabels([])
    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(labels)

    plt.savefig(sys.stdout.buffer, format='png')
    plt.close()

if __name__ == "__main__":
    scores = json.loads(sys.argv[1])
    create_radar_chart(scores)
